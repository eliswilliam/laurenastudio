"""
routes/auth.py
Authentication endpoints: register, login, forgot-password, verify-reset-code,
reset-password, Google OAuth (GET /google  →  GET /google/callback).
A `get_current_user` dependency is also exposed for protecting other routes.
"""
from collections import deque
import logging
from threading import Lock
from time import monotonic

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.google_oauth import oauth
from app.core.facebook_oauth import oauth_facebook
from app.core.security import decode_token
from app.db.session import get_db
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    MessageResponse,
    OneTapRequest,
    RegisterRequest,
    ResetPasswordRequest,
    VerifyResetCodeRequest,
    VerifyResetCodeResponse,
)
from app.schemas.user import UserRead, UserUpdateRequest
from app.services import auth_service
from app.services.welcome_email_service import run_welcome_email_task

router = APIRouter(prefix="/auth", tags=["Authentication"])

_bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)

_RATE_LIMIT_WINDOW_SECONDS = 15 * 60
_RATE_LIMIT_MAX_ATTEMPTS = 8
_RATE_LIMIT_STORE: dict[str, deque[float]] = {}
_RATE_LIMIT_LOCK = Lock()

# SECURITY: dedicated counters for login/register — higher per-IP allowance than
# password reset (legit users may retry a typo a few times) but still strict
# enough to stop credential-stuffing or signup floods. Per-email limit blunts
# distributed attacks that rotate the source IP against a single account.
_LOGIN_RATE_LIMIT_MAX_IP = 20
_LOGIN_RATE_LIMIT_MAX_EMAIL = 8
_REGISTER_RATE_LIMIT_MAX_IP = 5

# Legacy fallback: old uploads may exist as avatar/{user_id}.jpg/.png/etc.
_AVATAR_OBJECT_CANDIDATES = (".avatar", ".jpg", ".jpeg", ".png", ".gif", ".webp")


def _cookie_secure(request: Request) -> bool:
    env = (settings.APP_ENV or "").strip().lower()
    is_dev_like = settings.DEBUG or env in {"dev", "development", "local", "test", "testing"}
    if is_dev_like:
        return request.url.scheme == "https"
    return True


def _set_auth_cookies(response: Response, request: Request, access_token: str, refresh_token: str | None) -> None:
    secure = _cookie_secure(request)
    response.set_cookie(
        key=settings.AUTH_ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path="/",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    if refresh_token:
        response.set_cookie(
            key=settings.AUTH_REFRESH_COOKIE_NAME,
            value=refresh_token,
            httponly=True,
            secure=secure,
            samesite=settings.AUTH_COOKIE_SAMESITE,
            path="/",
            max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        )


def _clear_auth_cookies(response: Response, request: Request) -> None:
    secure = _cookie_secure(request)
    response.delete_cookie(
        key=settings.AUTH_ACCESS_COOKIE_NAME,
        path="/",
        secure=secure,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=settings.AUTH_REFRESH_COOKIE_NAME,
        path="/",
        secure=secure,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


def _rate_limit_key(scope: str, identifier: str) -> str:
    return f"{scope}:{identifier.strip().lower()}"


def _enforce_rate_limit(scope: str, identifier: str, *, max_attempts: int = _RATE_LIMIT_MAX_ATTEMPTS) -> None:
    now = monotonic()
    limit_key = _rate_limit_key(scope, identifier)
    with _RATE_LIMIT_LOCK:
        bucket = _RATE_LIMIT_STORE.setdefault(limit_key, deque())
        while bucket and now - bucket[0] > _RATE_LIMIT_WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="TOO_MANY_ATTEMPTS",
            )
        bucket.append(now)


async def _verify_recaptcha_v3(token: str | None, remote_ip: str | None, *, action: str) -> None:
    if not settings.RECAPTCHA_ENABLED:
        return

    if not settings.RECAPTCHA_SECRET_KEY:
        logger.error("RECAPTCHA_ENABLED=true but RECAPTCHA_SECRET_KEY is empty.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="RECAPTCHA_CONFIG_INVALID",
        )

    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RECAPTCHA_REQUIRED",
        )

    payload = {
        "secret": settings.RECAPTCHA_SECRET_KEY,
        "response": token,
    }
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://www.google.com/recaptcha/api/siteverify",
                data=payload,
            )
            data = response.json()
    except Exception as exc:
        logger.warning("reCAPTCHA verification request failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RECAPTCHA_UNAVAILABLE",
        )

    if not data.get("success"):
        logger.info("reCAPTCHA rejected token: errors=%s", data.get("error-codes"))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="RECAPTCHA_FAILED",
        )

    received_action = str(data.get("action") or "")
    if received_action != action:
        logger.warning(
            "reCAPTCHA action mismatch: expected=%s got=%s",
            action,
            received_action,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="RECAPTCHA_FAILED",
        )

    try:
        score = float(data.get("score", 0.0))
    except (TypeError, ValueError):
        score = 0.0

    if score < settings.RECAPTCHA_LOGIN_THRESHOLD:
        logger.info(
            "reCAPTCHA low score for %s: score=%.3f threshold=%.3f",
            action,
            score,
            settings.RECAPTCHA_LOGIN_THRESHOLD,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="RECAPTCHA_FAILED",
        )


# ── JWT dependency ────────────────────────────────────────────────────────────

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
):
    """
    Extract and validate the JWT from Authorization header or HttpOnly cookie.
    Returns the authenticated User ORM object.
    """
    token = (
        credentials.credentials
        if credentials and credentials.credentials
        else request.cookies.get(settings.AUTH_ACCESS_COOKIE_NAME)
    )
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub", "")
        token_type: str = payload.get("type", "")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user_id or token_type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await auth_service.get_user_by_id(db, user_id)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated.",
        )
    return user


# ── POST /auth/register ───────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description=(
        "Creates a user account, sets up the tenant record for billing "
        "and usage, assigns the admin role, and returns JWT tokens."
    ),
)
async def register(
    request: Request,
    response: Response,
    payload: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    client_ip = request.client.host if request.client else "unknown"
    # SECURITY: limit account creation per source IP to slow signup floods that
    # exhaust email senders or bypass paid quotas.
    _enforce_rate_limit("register-ip", client_ip, max_attempts=_REGISTER_RATE_LIMIT_MAX_IP)
    await _verify_recaptcha_v3(payload.recaptcha_token, client_ip, action="register")

    resp = await auth_service.register_user(db, payload)
    _set_auth_cookies(response, request, resp.tokens.access_token, resp.tokens.refresh_token)
    background_tasks.add_task(run_welcome_email_task, resp.user.id)
    return resp


# ── POST /auth/login ──────────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Login",
    description="Authenticate with email/password and receive JWT tokens.",
)
async def login(
    request: Request,
    response: Response,
    payload: LoginRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    client_ip = request.client.host if request.client else "unknown"
    # SECURITY: rate-limit login attempts per source IP and per email so that
    # neither credential-stuffing (many emails from one IP) nor distributed
    # brute force (many IPs against one email) can run unchecked. reCAPTCHA
    # is optional in this codebase, so this is the primary brute-force defense.
    _enforce_rate_limit("login-ip", client_ip, max_attempts=_LOGIN_RATE_LIMIT_MAX_IP)
    _enforce_rate_limit("login-email", payload.email, max_attempts=_LOGIN_RATE_LIMIT_MAX_EMAIL)
    await _verify_recaptcha_v3(payload.recaptcha_token, client_ip, action="login")

    resp = await auth_service.login_user(db, payload)
    _set_auth_cookies(response, request, resp.tokens.access_token, resp.tokens.refresh_token)
    background_tasks.add_task(run_welcome_email_task, resp.user.id)
    return resp


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout and clear auth cookies",
)
async def logout(request: Request, response: Response) -> MessageResponse:
    _clear_auth_cookies(response, request)
    return MessageResponse(message="Logged out.")


# ── POST /auth/forgot-password ────────────────────────────────────────────────

@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    summary="Request a password reset code",
    description=(
        "Generates a 6-digit time-limited code (10 min) and sends it "
        "to the user's e-mail via Gmail SMTP."
    ),
)
async def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> ForgotPasswordResponse:
    client_ip = request.client.host if request.client else "unknown"
    _enforce_rate_limit("forgot-password-ip", client_ip)
    _enforce_rate_limit("forgot-password-email", payload.email)
    return await auth_service.forgot_password(db, payload.email)


# ── POST /auth/verify-reset-code ──────────────────────────────────────────────

@router.post(
    "/verify-reset-code",
    response_model=VerifyResetCodeResponse,
    summary="Validate a 6-digit reset code without consuming it",
)
async def verify_reset_code(
    request: Request,
    payload: VerifyResetCodeRequest,
    db: AsyncSession = Depends(get_db),
) -> VerifyResetCodeResponse:
    client_ip = request.client.host if request.client else "unknown"
    _enforce_rate_limit("verify-reset-code-ip", client_ip)
    _enforce_rate_limit("verify-reset-code-email", payload.email)
    return await auth_service.verify_reset_code(db, payload)


# ── POST /auth/reset-password ─────────────────────────────────────────────────

@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reset password using the 6-digit code",
    description="Validates the code, hashes the new password, and invalidates the code.",
)
async def reset_password(
    request: Request,
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    client_ip = request.client.host if request.client else "unknown"
    _enforce_rate_limit("reset-password-ip", client_ip)
    _enforce_rate_limit("reset-password-email", payload.email)
    return await auth_service.reset_password(db, payload)


# ── GET /auth/me ──────────────────────────────────────────────────────────────

@router.get(
    "/me",
    response_model=UserRead,
    summary="Get current authenticated user",
)
async def me(current_user=Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


# ── PUT /auth/me ──────────────────────────────────────────────────────────────

@router.put(
    "/me",
    response_model=UserRead,
    summary="Update current user profile",
)
async def update_me(
    payload: UserUpdateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserRead:
    return await auth_service.update_user_profile(db, current_user, payload)


@router.post(
    "/me/avatar",
    response_model=UserRead,
    summary="Upload profile avatar (max 5MB)",
)
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserRead:
    return await auth_service.upload_user_avatar(db, current_user, file)


@router.get(
    "/avatar/{user_id}",
    summary="Serve user avatar (proxied from GCS)",
    include_in_schema=False,
)
async def serve_avatar(user_id: str):
    """
    Public endpoint — proxies the avatar image from GCS via the authenticated
    service account.  Works regardless of bucket ACL policy (uniform access).
    The deterministic GCS path is avatar/{user_id}.avatar.
    """
    from fastapi.responses import Response as BinaryResponse
    from app.services.gcs_service import download_blob
    from google.cloud.exceptions import NotFound

    last_exc: Exception | None = None
    data: bytes | None = None
    content_type = "application/octet-stream"

    for ext in _AVATAR_OBJECT_CANDIDATES:
        object_path = f"avatar/{user_id}{ext}"
        try:
            data, content_type = download_blob(object_path)
            break
        except NotFound:
            continue
        except Exception as exc:
            # Keep scanning other legacy suffixes, but preserve the latest error for logs.
            last_exc = exc

    if data is None:
        if last_exc is not None:
            logger.warning("serve_avatar: failed to download avatar for user %s: %s", user_id, last_exc)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found.")

    return BinaryResponse(
        content=data,
        media_type=content_type,
        # Each avatar URL includes ?v={timestamp} so it is unique per upload.
        # "immutable" tells the browser (and any CDN) to cache forever — correct
        # because a new upload always produces a new URL.
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


# ── GET /auth/google ───────────────────────────────────────────────────────────

@router.get(
    "/google",
    summary="Initiate Google OAuth login",
    description="Redirects the browser to Google’s consent screen.",
)
async def google_login(request: Request):
    # Use hardcoded backend URL so the redirect_uri is always correct
    # regardless of whether the request comes through the Vite proxy.
    redirect_uri = f"{settings.BACKEND_URL}/api/v1/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


# ── GET /auth/google/callback ───────────────────────────────────────────────────

@router.get(
    "/google/callback",
    name="google_callback",
    summary="Google OAuth callback",
    description="Handles the redirect from Google, creates/updates the user, and returns JWT tokens via front-end redirect.",
)
async def google_callback(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = await oauth.google.userinfo(token=token)
        auth_resp = await auth_service.google_oauth_login(db, dict(user_info))
        background_tasks.add_task(run_welcome_email_task, auth_resp.user.id)

        response = RedirectResponse(url=f"{settings.FRONTEND_URL}/auth/callback")
        _set_auth_cookies(response, request, auth_resp.tokens.access_token, auth_resp.tokens.refresh_token)
        return response
    except Exception as exc:
        # SECURITY: ne pas exposer les détails internes dans l'URL
        import urllib.parse
        logger.exception("Google OAuth callback error: %s", exc)
        error_msg = urllib.parse.quote("Erro de autenticação. Tente novamente.")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error={error_msg}"
        )


# ── POST /auth/google/one-tap ──────────────────────────────────────────────────────

@router.post(
    "/google/one-tap",
    summary="Google One Tap login",
    description="Verifies a Google One Tap credential (id_token JWT) and creates a session.",
)
async def google_one_tap(
    body: OneTapRequest,
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests

    credential = (body.credential or "").strip()
    if not credential:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Missing credential.")

    client_id = (settings.GOOGLE_CLIENT_ID or "").strip()
    if not client_id:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Google client ID not configured.")

    try:
        id_info = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            client_id,
            clock_skew_in_seconds=10,
        )
    except ValueError as exc:
        logger.warning("One Tap token verification failed: %s", exc)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Token Google inválido.") from exc

    user_info = {
        "sub": id_info["sub"],
        "email": id_info["email"],
        "name": id_info.get("name"),
        "picture": id_info.get("picture"),
    }

    try:
        auth_resp = await auth_service.google_oauth_login(db, user_info)
    except Exception as exc:
        logger.exception("One Tap login error: %s", exc)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro ao autenticar.") from exc

    background_tasks.add_task(run_welcome_email_task, auth_resp.user.id)
    _set_auth_cookies(response, request, auth_resp.tokens.access_token, auth_resp.tokens.refresh_token)
    return {"ok": True}


# ── GET /auth/facebook ─────────────────────────────────────────────────────────────

@router.get(
    "/facebook",
    summary="Initiate Facebook OAuth login",
    description="Redirects the browser to Facebook's consent screen.",
)
async def facebook_login(request: Request):
    redirect_uri = f"{settings.BACKEND_URL}/api/v1/auth/facebook/callback"
    return await oauth_facebook.facebook.authorize_redirect(request, redirect_uri)


# ── GET /auth/facebook/callback ──────────────────────────────────────────────────

@router.get(
    "/facebook/callback",
    name="facebook_callback",
    summary="Facebook OAuth callback",
    description="Handles the redirect from Facebook, creates/updates the user, and returns JWT tokens via front-end redirect.",
)
async def facebook_callback(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    try:
        token = await oauth_facebook.facebook.authorize_access_token(request)
        # Fetch user info from Graph API including email and picture
        resp = await oauth_facebook.facebook.get(
            "me",
            token=token,
            params={"fields": "id,name,email,picture.type(large)"},
        )
        user_info = resp.json()
        auth_resp = await auth_service.facebook_oauth_login(db, user_info)
        background_tasks.add_task(run_welcome_email_task, auth_resp.user.id)

        response = RedirectResponse(url=f"{settings.FRONTEND_URL}/auth/callback")
        _set_auth_cookies(response, request, auth_resp.tokens.access_token, auth_resp.tokens.refresh_token)
        return response
    except Exception as exc:
        # SECURITY: ne pas exposer les détails internes dans l'URL
        import urllib.parse
        logger.exception("Facebook OAuth callback error: %s", exc)
        error_msg = urllib.parse.quote("Erro de autenticação. Tente novamente.")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error={error_msg}"
        )
