"""
routes/auth.py
Authentication endpoints: register, login, forgot-password, verify-reset-code,
reset-password, Google OAuth (GET /google  →  GET /google/callback).
A `get_current_user` dependency is also exposed for protecting other routes.
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
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
    RegisterRequest,
    ResetPasswordRequest,
    VerifyResetCodeRequest,
    VerifyResetCodeResponse,
)
from app.schemas.user import UserRead, UserUpdateRequest
from app.services import auth_service
from app.services.welcome_email_service import run_welcome_email_task

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
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    resp = await auth_service.register_user(db, payload)
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
    payload: LoginRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    resp = await auth_service.login_user(db, payload)
    background_tasks.add_task(run_welcome_email_task, resp.user.id)
    return resp


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
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> ForgotPasswordResponse:
    return await auth_service.forgot_password(db, payload.email)


# ── POST /auth/verify-reset-code ──────────────────────────────────────────────

@router.post(
    "/verify-reset-code",
    response_model=VerifyResetCodeResponse,
    summary="Validate a 6-digit reset code without consuming it",
)
async def verify_reset_code(
    payload: VerifyResetCodeRequest,
    db: AsyncSession = Depends(get_db),
) -> VerifyResetCodeResponse:
    return await auth_service.verify_reset_code(db, payload)


# ── POST /auth/reset-password ─────────────────────────────────────────────────

@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reset password using the 6-digit code",
    description="Validates the code, hashes the new password, and invalidates the code.",
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