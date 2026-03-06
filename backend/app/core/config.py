import json
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Azure App Service can inject empty-string env vars for settings that exist
# but have no value.  Map them back to the field defaults so Pydantic
# validation never sees "" or None for typed fields.
_FIELD_DEFAULTS = {
    "DEBUG": False,
    "ACCESS_TOKEN_EXPIRE_MINUTES": 15,
    "REFRESH_TOKEN_EXPIRE_DAYS": 7,
    "RESET_TOKEN_EXPIRE_MINUTES": 30,
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "Laurena Studio"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:example@localhost:5432/laurenadb"
    )

    # ── JWT ──────────────────────────────────────────────────────────────────
    SECRET_KEY: str = "CHANGE-ME-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Password reset ───────────────────────────────────────────────────────
    RESET_TOKEN_EXPIRE_MINUTES: int = 30

    @field_validator(
        "DEBUG",
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "REFRESH_TOKEN_EXPIRE_DAYS",
        "RESET_TOKEN_EXPIRE_MINUTES",
        mode="before",
    )
    @classmethod
    def _coerce_empty(cls, v: object, info) -> object:
        if v is None or (isinstance(v, str) and v.strip() == ""):
            return _FIELD_DEFAULTS.get(info.field_name, v)
        return v

    # ── Google OAuth ──────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # ── Session (required by Starlette SessionMiddleware for OAuth flow) ─────
    SESSION_SECRET_KEY: str = "CHANGE-ME-session-secret-use-openssl-rand-hex-32"

    # ── Frontend URL (used for post-OAuth redirect) ───────────────────────────
    FRONTEND_URL: str = "http://localhost:8080"

    # ── Backend URL (used to build the Google OAuth callback URI) ────────────
    BACKEND_URL: str = "http://localhost:8000"

    # ── SMTP / Email (Gmail App Password) ────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""  # Gmail App Password
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "Laurena Studio"

    # ── Stripe ────────────────────────────────────────────────────────────
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    # Price IDs — one per plan (subscription mode)
    STRIPE_PRICE_ID_STARTER: str = ""
    STRIPE_PRICE_ID_PRO: str = ""
    STRIPE_PRICE_ID_BUSINESS: str = ""

    # ── CORS ─────────────────────────────────────────────────────────────
    # Stored as a comma-separated string for env-var compatibility
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080"

    @property
    def allowed_origins_list(self) -> list[str]:
        """Parse ALLOWED_ORIGINS into a list (supports JSON array or comma-separated)."""
        val = self.ALLOWED_ORIGINS
        try:
            parsed = json.loads(val)
            if isinstance(parsed, list):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass
        return [o.strip() for o in val.split(",") if o.strip()]


settings = Settings()
