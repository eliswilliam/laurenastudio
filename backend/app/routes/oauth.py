"""
OAuth2-like Authorization Server for the Laurena Builder subdomain.

Flow (browser-side):
  1. GET /api/v1/oauth/authorize?redirect_uri=...&state=...
     - Validates the user's JWT cookie (ls_access_token)
     - If not logged in → redirects to /login
     - Generates a one-time code → stored in Redis db=1, TTL 10 min
     - Redirects browser to redirect_uri?code=<code>&state=<state>

Flow (server-to-server):
  2. POST /api/v1/oauth/token   (called by the Next.js backend, never by the browser)
     - Requires Authorization: Bearer <OAUTH_TOKEN_SECRET>
     - Exchanges the one-time code for { user_id, email, name, avatar }
     - Deletes the code from Redis (single use)
"""

import logging
import secrets
import urllib.parse

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import get_db
from app.models.membership import Membership
from app.services import auth_service, billing_service
from sqlalchemy import select

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/oauth", tags=["OAuth2 Authorization Server"])

_REDIS_DB = 1          # Isolated from ARQ (db=0)
_CODE_PREFIX = "oauth:code:"
_CODE_TTL = 600        # 10 minutes


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _redis() -> aioredis.Redis:
    """One-shot async Redis client on the OAuth database (db=1)."""
    url = settings.REDIS_URL.rstrip("/")
    # Strip any existing db suffix and use db=1
    if "/" in url.split("://", 1)[-1]:
        base = url.rsplit("/", 1)[0]
    else:
        base = url
    return aioredis.from_url(f"{base}/{_REDIS_DB}", decode_responses=True)


def _check_redirect_uri(uri: str) -> None:
    """
    SECURITY: Validation stricte du redirect_uri.
    - Comparaison exacte avec la liste blanche (pas de prefix/suffix match)
    - Normalisation avant comparaison pour éviter les contournements par encodage URL,
      trailing slashes, ou fragments
    - Seuls les schémas https:// sont acceptés (sauf localhost en dev)
    """
    import urllib.parse as _urlparse

    if not uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="redirect_uri is required.",
        )

    # Normaliser : décoder l'encodage URL, supprimer les fragments, strip
    try:
        parsed = _urlparse.urlparse(uri)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="redirect_uri is malformed.",
        )

    # Rejeter les fragments (ex: https://evil.com/callback#https://allowed.com)
    if parsed.fragment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="redirect_uri must not contain a fragment.",
        )

    # Rejeter les schémas non-https (sauf localhost en développement)
    is_localhost = parsed.hostname in ("localhost", "127.0.0.1", "::1")
    if parsed.scheme != "https" and not is_localhost:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="redirect_uri must use HTTPS.",
        )

    # Normaliser l'URI pour la comparaison (supprimer le trailing slash)
    normalized = uri.rstrip("/")

    allowed = [u.strip().rstrip("/") for u in settings.OAUTH_ALLOWED_REDIRECT_URIS.split(",") if u.strip()]
    if normalized not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="redirect_uri not allowed.",
        )


# ── GET /oauth/authorize ──────────────────────────────────────────────────────

@router.get("/authorize", summary="Start OAuth2 authorization (browser redirect)")
async def authorize(
    request: Request,
    redirect_uri: str,
    state: str = "",
    db: AsyncSession = Depends(get_db),
):
    """
    Validate the user's Laurena JWT cookie, emit a one-time code and redirect
    the browser to `redirect_uri?code=<code>&state=<state>`.

    If the user is not authenticated, redirect to the main-domain login page.
    """
    _check_redirect_uri(redirect_uri)

    # ── 1. Validate JWT from HttpOnly cookie ──────────────────────────────
    token = request.cookies.get(settings.AUTH_ACCESS_COOKIE_NAME)
    if not token:
        return _redirect_to_login(request)

    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub", "")
        if not user_id or payload.get("type") != "access":
            raise JWTError("invalid payload")
    except JWTError:
        return _redirect_to_login(request)

    # ── 2. Load user from DB ──────────────────────────────────────────────
    try:
        user = await auth_service.get_user_by_id(db, user_id)
    except Exception:
        return _redirect_to_login(request)

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated.")

    # ── 3. Resolve subscription (workspace → plan) ────────────────────────
    subscription_id = ""
    plan_name = ""
    # Default False: only users with an active paid plan can access the builder.
    # A missing subscription = no plan = no access → redirected to /escolher-plano.
    plan_active = False

    try:
        membership_result = await db.execute(
            select(Membership)
            .where(Membership.user_id == user.id)
            .order_by(Membership.created_at.asc())
            .limit(1)
        )
        membership = membership_result.scalars().first()
        if membership:
            sub = await billing_service.get_subscription_for_workspace(db, membership.workspace_id)
            if sub:
                subscription_id = sub.id
                plan_name = sub.plan.name if sub.plan else ""
                # Accept active + trialing + past_due as "plan is accessible"
                # canceled / incomplete_expired / unpaid = blocked
                plan_active = sub.status in ("active", "trialing", "past_due")
            # No subscription found → plan_active stays False
    except Exception as exc:
        logger.warning("Could not resolve subscription for user_id=%s: %s", user.id, exc)
        # On DB error, fail open — don't lock users out due to a transient DB issue
        plan_active = True

    # ── 4. Generate one-time code and store in Redis ──────────────────────
    code = secrets.token_urlsafe(32)
    # Pipe-separated: user_id|email|name|avatar|subscription_id|plan_name|plan_active|state
    record = "|".join([
        user.id,
        user.email or "",
        (user.full_name or "").replace("|", " "),
        (user.avatar_url or "").replace("|", "%7C"),
        subscription_id,
        plan_name,
        "1" if plan_active else "0",
        state,
    ])

    client = await _redis()
    try:
        await client.setex(f"{_CODE_PREFIX}{code}", _CODE_TTL, record)
    finally:
        await client.aclose()

    logger.info("OAuth code issued for user_id=%s → %s", user_id, redirect_uri)

    # ── 4. Redirect browser to subdomain callback ─────────────────────────
    params = urllib.parse.urlencode({"code": code, "state": state})
    return RedirectResponse(url=f"{redirect_uri}?{params}", status_code=302)


def _redirect_to_login(request: Request) -> RedirectResponse:
    next_url = urllib.parse.quote(str(request.url), safe="")
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/login?next={next_url}",
        status_code=302,
    )


# ── POST /oauth/token ─────────────────────────────────────────────────────────

class TokenRequest(BaseModel):
    code: str


class TokenResponse(BaseModel):
    user_id: str
    email: str
    name: str
    avatar: str
    subscription_id: str
    plan_name: str
    plan_active: bool


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Exchange authorization code for user info (server-to-server)",
)
async def exchange_token(request: Request, body: TokenRequest):
    """
    Called by the Next.js backend only — never by the browser.
    Requires `Authorization: Bearer <OAUTH_TOKEN_SECRET>`.
    Returns user info and deletes the code (single-use).
    """
    # ── Validate shared secret (timing-safe) ──────────────────────────────
    # SECURITY: secrets.compare_digest avoids leaking the secret one byte at a
    # time via response-time differences. The same comparison style is used in
    # routes/builder.py:_require_service_token — keep them consistent.
    auth_header = request.headers.get("Authorization", "")
    expected = f"Bearer {settings.OAUTH_TOKEN_SECRET}"
    if not secrets.compare_digest(auth_header.encode(), expected.encode()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing OAUTH_TOKEN_SECRET.",
        )

    # ── Retrieve and delete code from Redis ───────────────────────────────
    client = await _redis()
    try:
        value: str | None = await client.get(f"{_CODE_PREFIX}{body.code}")
        if not value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Authorization code is invalid or has expired.",
            )
        await client.delete(f"{_CODE_PREFIX}{body.code}")
    finally:
        await client.aclose()

    # ── Parse stored record ───────────────────────────────────────────────
    # Format: user_id|email|name|avatar|subscription_id|plan_name|plan_active|state
    parts = value.split("|", 7)
    user_id         = parts[0]
    email           = parts[1]
    name            = parts[2] if len(parts) > 2 else email
    avatar          = parts[3] if len(parts) > 3 else ""
    subscription_id = parts[4] if len(parts) > 4 else ""
    plan_name       = parts[5] if len(parts) > 5 else ""
    plan_active     = parts[6] == "1" if len(parts) > 6 else False

    logger.info("OAuth code exchanged for user_id=%s plan_active=%s", user_id, plan_active)

    return TokenResponse(
        user_id=user_id,
        email=email,
        name=name or email,
        avatar=avatar,
        subscription_id=subscription_id,
        plan_name=plan_name,
        plan_active=plan_active,
    )
