"""
auth_service.py
All business logic for authentication and user account management.
"""
import random
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
    VerifyResetCodeRequest,
    VerifyResetCodeResponse,
)
from app.schemas.user import UserRead, UserUpdateRequest
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

_RESET_CODE_EXPIRY_MINUTES = 10  # 6-digit code valid for 10 minutes


def _make_token(user_id: str, code: str) -> str:
    """Composite token stored in DB: '{user_id}:{code}'. Preserves unique constraint."""
    return f"{user_id}:{code}"


async def forgot_password(db: AsyncSession, email: str) -> ForgotPasswordResponse:
    from app.services.email_service import send_password_reset_code

    user = await _get_user_by_email(db, email)

    # Always return the same message to prevent e-mail enumeration
    generic_msg = "Se este e-mail estiver cadastrado, você receberá um código de recuperação."

    if not user:
        return ForgotPasswordResponse(message=generic_msg)

    # Invalidate previous active codes for this user
    result = await db.execute(
        select(PasswordReset).where(
            PasswordReset.user_id == user.id,
            PasswordReset.used == False,  # noqa: E712
        )
    )
    for old in result.scalars().all():
        old.used = True

    # Generate a random 6-digit code
    code = str(random.randint(100000, 999999))
    token = _make_token(user.id, code)

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=_RESET_CODE_EXPIRY_MINUTES)
    reset_record = PasswordReset(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token=token,
        expires_at=expires_at,
        used=False,
    )
    db.add(reset_record)
    await db.commit()

    # Send the 6-digit code via Gmail SMTP (non-blocking)
    await send_password_reset_code(to_email=user.email, code=code)

    return ForgotPasswordResponse(message=generic_msg)


# ── Verify reset code ─────────────────────────────────────────────────────────

async def _lookup_reset_record(
    db: AsyncSession, email: str, code: str
) -> tuple[User, PasswordReset]:
    """Find and validate a password-reset record by (email, code)."""
    user = await _get_user_by_email(db, email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código inválido ou expirado.",
        )

    token = _make_token(user.id, code)
    result = await db.execute(
        select(PasswordReset).where(
            PasswordReset.token == token,
            PasswordReset.used == False,  # noqa: E712
        )
    )
    record = result.scalars().first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código inválido ou expirado.",
        )

    if record.is_expired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código expirado. Solicite um novo código.",
        )

    return user, record


async def verify_reset_code(
    db: AsyncSession, payload: VerifyResetCodeRequest
) -> VerifyResetCodeResponse:
    await _lookup_reset_record(db, payload.email, payload.code)
    return VerifyResetCodeResponse(valid=True, message="Código válido.")


# ── Reset password ────────────────────────────────────────────────────────────

async def reset_password(db: AsyncSession, payload: ResetPasswordRequest) -> MessageResponse:
    user, record = await _lookup_reset_record(db, payload.email, payload.code)

    # Update password with secure hash
    user.password_hash = hash_password(payload.new_password)

    # Invalidate the used code
    record.used = True

    await db.commit()

    return MessageResponse(message="Senha atualizada com sucesso.")


# ── Update user profile ───────────────────────────────────────────────────────

async def update_user_profile(
    db: AsyncSession, user: User, payload: UserUpdateRequest
) -> UserRead:
    # Optional password change — requires current_password verification
    if payload.new_password:
        if not payload.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A senha atual é obrigatória para alterar a senha.",
            )
        if not user.password_hash or not verify_password(
            payload.current_password, user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Senha atual incorreta.",
            )
        if len(payload.new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A nova senha deve ter pelo menos 8 caracteres.",
            )
        user.password_hash = hash_password(payload.new_password)

    # Update profile fields (only if provided)
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.bio is not None:
        user.bio = payload.bio
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url

    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


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

async def facebook_oauth_login(db: AsyncSession, user_info: dict) -> AuthResponse:
    """
    Sign in or register a user via Facebook OAuth.
    - If facebook_id already exists → update profile & login.
    - If email matches existing user → link facebook_id & login.
    - Otherwise → create new user + default workspace.
    """
    facebook_id: str = str(user_info["id"])
    email: str | None = user_info.get("email")  # may be absent if user hid it
    full_name: str | None = user_info.get("name")
    avatar_url: str | None = (
        user_info.get("picture", {}).get("data", {}).get("url")
        if isinstance(user_info.get("picture"), dict)
        else None
    )

    # 1. Lookup by facebook_id
    result = await db.execute(select(User).where(User.facebook_id == facebook_id))
    user = result.scalars().first()

    workspace: Workspace | None = None

    if not user:
        # 2. Try to find existing user by email (link accounts)
        if email:
            user = await _get_user_by_email(db, email)
        if user:
            user.facebook_id = facebook_id
            if full_name:
                user.full_name = full_name
            if avatar_url:
                user.avatar_url = avatar_url
        else:
            # 3. Brand new user via Facebook
            if not email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Facebook did not provide an email address. Please grant email permission.",
                )
            user = User(
                id=str(uuid.uuid4()),
                email=email,
                facebook_id=facebook_id,
                full_name=full_name,
                avatar_url=avatar_url,
                password_hash=None,
                is_active=True,
            )
            db.add(user)
            await db.flush()

            given = email.split("@")[0]
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
        # Update existing Facebook user profile
        if full_name:
            user.full_name = full_name
        if avatar_url:
            user.avatar_url = avatar_url

    await db.commit()
    await db.refresh(user)

    if workspace is None:
        result = await db.execute(
            select(Workspace).where(Workspace.owner_id == user.id).limit(1)
        )
        workspace = result.scalars().first()

    if workspace is None:
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
