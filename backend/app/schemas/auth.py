from pydantic import BaseModel, EmailStr, field_validator

from app.schemas.user import UserRead


# ── Request schemas ───────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    account_name: str = "Minha conta"
    full_name: str | None = None
    recaptcha_token: str | None = None

    @field_validator("full_name", mode="before")
    @classmethod
    def normalize_full_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s[:255] if s else None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    recaptcha_token: str | None = None


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


class OneTapRequest(BaseModel):
    credential: str  # JWT issued by Google One Tap / FedCM


# ── Response schemas ──────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    user: UserRead
    tokens: TokenResponse
    tenant_id: str


class ForgotPasswordResponse(BaseModel):
    message: str


class VerifyResetCodeResponse(BaseModel):
    valid: bool
    message: str


class MessageResponse(BaseModel):
    message: str
