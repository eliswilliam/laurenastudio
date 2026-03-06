from pydantic import BaseModel, EmailStr, field_validator

from app.schemas.user import UserRead
from app.schemas.workspace import WorkspaceRead


# ── Request schemas ───────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    workspace_name: str = "My Workspace"

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str  # 6-digit code sent by email


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str  # 6-digit code sent by email
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


# ── Response schemas ──────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    user: UserRead
    workspace: WorkspaceRead
    tokens: TokenResponse


class ForgotPasswordResponse(BaseModel):
    message: str


class VerifyResetCodeResponse(BaseModel):
    valid: bool
    message: str


class MessageResponse(BaseModel):
    message: str
