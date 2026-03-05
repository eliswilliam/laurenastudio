"""
routes/auth.py
Authentication endpoints: register, login, forgot-password, reset-password,
Google OAuth (GET /google  →  GET /google/callback).
A `get_current_user` dependency is also exposed for protecting other routes.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.google_oauth import oauth
from app.core.security import decode_token
from app.db.session import get_db
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
)
from app.schemas.user import UserRead
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

_bearer = HTTPBearer(auto_error=True)


# ── JWT dependency ────────────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
):
    """
    Extract and validate the JWT from the Authorization header.
    Returns the authenticated User ORM object.
    """
    token = credentials.credentials
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
        "Creates a user account, generates a default workspace, "
        "assigns the admin role, and returns JWT tokens."
    ),
)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    return await auth_service.register_user(db, payload)


# ── POST /auth/login ──────────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Login",
    description="Authenticate with email/password and receive JWT tokens.",
)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    return await auth_service.login_user(db, payload)


# ── POST /auth/forgot-password ────────────────────────────────────────────────

@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    summary="Request a password reset token",
    description=(
        "Generates a time-limited reset token (30 min). "
        "In production the token is emailed; it is also returned in the response for testing."
    ),
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> ForgotPasswordResponse:
    return await auth_service.forgot_password(db, payload.email)


# ── POST /auth/reset-password ─────────────────────────────────────────────────

@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reset password using a reset token",
    description="Validates the token, hashes the new password, and invalidates the token.",
)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    return await auth_service.reset_password(db, payload)


# ── GET /auth/me ──────────────────────────────────────────────────────────────

@router.get(
    "/me",
    response_model=UserRead,
    summary="Get current authenticated user",
)
async def me(current_user=Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)

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
    db: AsyncSession = Depends(get_db),
):
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = await oauth.google.userinfo(token=token)
        auth_resp = await auth_service.google_oauth_login(db, dict(user_info))

        # Redirect to the React SPA callback route with tokens as query params
        return RedirectResponse(
            url=(
                f"{settings.FRONTEND_URL}/auth/callback"
                f"?access_token={auth_resp.tokens.access_token}"
                f"&refresh_token={auth_resp.tokens.refresh_token or ''}"
            )
        )
    except Exception as exc:
        import urllib.parse
        error_msg = urllib.parse.quote(str(exc))
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error={error_msg}"
        )