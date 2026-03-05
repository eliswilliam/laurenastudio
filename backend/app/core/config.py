from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # ── Google OAuth ──────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # ── Session (required by Starlette SessionMiddleware for OAuth flow) ─────
    SESSION_SECRET_KEY: str = "CHANGE-ME-session-secret-use-openssl-rand-hex-32"

    # ── Frontend URL (used for post-OAuth redirect) ───────────────────────────
    FRONTEND_URL: str = "http://localhost:8080"

    # ── Backend URL (used to build the Google OAuth callback URI) ────────────
    BACKEND_URL: str = "http://localhost:8000"

    # ── Stripe ────────────────────────────────────────────────────────────
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    # Price IDs — one per plan (subscription mode)
    STRIPE_PRICE_ID_STARTER: str = ""
    STRIPE_PRICE_ID_PRO: str = ""
    STRIPE_PRICE_ID_BUSINESS: str = ""

    # ── CORS ─────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"]


settings = Settings()
