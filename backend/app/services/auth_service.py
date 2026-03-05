"""
auth_service.py
All business logic for authentication and user account management.
"""
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.membership import Membership
from app.models.password_reset import PasswordReset
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordResponse,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.user import UserRead
from app.schemas.workspace import WorkspaceRead


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalars().first()


async def _get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalars().first()


# ── Register ──────────────────────────────────────────────────────────────────

async def register_user(db: AsyncSession, payload: RegisterRequest) -> AuthResponse:
    # 1. Check uniqueness
    if await _get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered.",
        )

    # 2. Create user
    user = User(
        id=str(uuid.uuid4()),
        email=payload.email,
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    db.add(user)
    await db.flush()  # flush to get the user.id without committing

    # 3. Create default workspace
    workspace = Workspace(
        id=str(uuid.uuid4()),
        name=payload.workspace_name,
        owner_id=user.id,
    )
    db.add(workspace)
    await db.flush()

    # 4. Create admin membership
    membership = Membership(
        id=str(uuid.uuid4()),
        user_id=user.id,
        workspace_id=workspace.id,
        role="admin",
    )
    db.add(membership)
    await db.commit()
    await db.refresh(user)
    await db.refresh(workspace)

    # 5. Generate tokens
    tokens = TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )

    return AuthResponse(
        user=UserRead.model_validate(user),
        workspace=WorkspaceRead.model_validate(workspace),
        tokens=tokens,
    )


# ── Login ─────────────────────────────────────────────────────────────────────

async def login_user(db: AsyncSession, payload: LoginRequest) -> AuthResponse:
    # 1. Lookup user
    user = await _get_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated.",
        )

    # 2. Get primary workspace (first owned workspace)
    result = await db.execute(
        select(Workspace).where(Workspace.owner_id == user.id).limit(1)
    )
    workspace = result.scalars().first()

    if workspace is None:
        # Edge-case: create default workspace on first login if missing
        workspace = Workspace(
            id=str(uuid.uuid4()),
            name="My Workspace",
            owner_id=user.id,
        )
        db.add(workspace)
        membership = Membership(
            id=str(uuid.uuid4()),
            user_id=user.id,
            workspace_id=workspace.id,
            role="admin",
        )
        db.add(membership)
        await db.commit()
        await db.refresh(workspace)

    tokens = TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )

    return AuthResponse(
        user=UserRead.model_validate(user),
        workspace=WorkspaceRead.model_validate(workspace),
        tokens=tokens,
    )


# ── Forgot password ───────────────────────────────────────────────────────────

async def forgot_password(db: AsyncSession, email: str) -> ForgotPasswordResponse:
    user = await _get_user_by_email(db, email)

    # Always return success to prevent email enumeration
    if not user:
        return ForgotPasswordResponse(
            message="If this email is registered you will receive reset instructions."
        )

    # Invalidate previous active tokens for this user
    result = await db.execute(
        select(PasswordReset).where(
            PasswordReset.user_id == user.id,
            PasswordReset.used == False,  # noqa: E712
        )
    )
    for old_token in result.scalars().all():
        old_token.used = True

    # Create new token
    raw_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.RESET_TOKEN_EXPIRE_MINUTES
    )
    reset_record = PasswordReset(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token=raw_token,
        expires_at=expires_at,
        used=False,
    )
    db.add(reset_record)
    await db.commit()

    # In production: send email here (e.g. via SendGrid / Azure Communication Services)
    # For now, return the token in the response so it can be tested directly.
    return ForgotPasswordResponse(
        message="Reset token generated. Check your email (token returned for testing).",
        reset_token=raw_token,
    )


# ── Reset password ────────────────────────────────────────────────────────────

async def reset_password(db: AsyncSession, payload: ResetPasswordRequest) -> MessageResponse:
    # 1. Look up the token record
    result = await db.execute(
        select(PasswordReset).where(PasswordReset.token == payload.token)
    )
    record = result.scalars().first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token.",
        )

    # 2. Already used?
    if record.used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has already been used.",
        )

    # 3. Expired?
    if record.is_expired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired.",
        )

    # 4. Update password
    user = await _get_user_by_id(db, record.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    user.password_hash = hash_password(payload.new_password)

    # 5. Invalidate token
    record.used = True

    await db.commit()

    return MessageResponse(message="Password updated successfully.")


# ── Get current user (used by JWT dependency) ─────────────────────────────────

async def get_user_by_id(db: AsyncSession, user_id: str) -> User:
    user = await _get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    return user


# ── Google OAuth login / register ────────────────────────────────────────────

async def google_oauth_login(db: AsyncSession, user_info: dict) -> AuthResponse:
    """
    Sign in or register a user via Google OAuth.
    - If google_id already exists → update profile & login.
    - If email matches existing user → link google_id & login.
    - Otherwise → create new user + default workspace.
    """
    google_id: str = user_info["sub"]
    email: str = user_info["email"]
    full_name: str | None = user_info.get("name")
    avatar_url: str | None = user_info.get("picture")

    # 1. Lookup by google_id
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalars().first()

    workspace: Workspace | None = None

    if not user:
        # 2. Try to find existing user by email (link accounts)
        user = await _get_user_by_email(db, email)
        if user:
            user.google_id = google_id
            user.full_name = full_name
            user.avatar_url = avatar_url
        else:
            # 3. Brand new user via Google
            user = User(
                id=str(uuid.uuid4()),
                email=email,
                google_id=google_id,
                full_name=full_name,
                avatar_url=avatar_url,
                password_hash=None,
                is_active=True,
            )
            db.add(user)
            await db.flush()

            # Create default workspace
            given = user_info.get("given_name") or email.split("@")[0]
            workspace = Workspace(
                id=str(uuid.uuid4()),
                name=f"{given}'s Workspace",
                owner_id=user.id,
            )
            db.add(workspace)
            await db.flush()

            membership = Membership(
                id=str(uuid.uuid4()),
                user_id=user.id,
                workspace_id=workspace.id,
                role="admin",
            )
            db.add(membership)
    else:
        # Update existing Google user profile
        user.full_name = full_name
        user.avatar_url = avatar_url

    await db.commit()
    await db.refresh(user)

    # Load primary workspace if not already set above
    if workspace is None:
        result = await db.execute(
            select(Workspace).where(Workspace.owner_id == user.id).limit(1)
        )
        workspace = result.scalars().first()

    if workspace is None:
        # Edge-case: create workspace if missing
        workspace = Workspace(
            id=str(uuid.uuid4()),
            name="My Workspace",
            owner_id=user.id,
        )
        db.add(workspace)
        membership = Membership(
            id=str(uuid.uuid4()),
            user_id=user.id,
            workspace_id=workspace.id,
            role="admin",
        )
        db.add(membership)
        await db.commit()
        await db.refresh(workspace)

    tokens = TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )

    return AuthResponse(
        user=UserRead.model_validate(user),
        workspace=WorkspaceRead.model_validate(workspace),
        tokens=tokens,
    )
