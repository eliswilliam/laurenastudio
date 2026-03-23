import json
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/.env — absolute path so local dev finds the file regardless of cwd.
# Azure: no .env file on disk; App Settings are read from the process environment only.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _BACKEND_ROOT / ".env"

_SETTINGS_ENV_FILE: dict[str, str] = {}
if _ENV_FILE.is_file():
    _SETTINGS_ENV_FILE = {"env_file": str(_ENV_FILE), "env_file_encoding": "utf-8"}


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
        **_SETTINGS_ENV_FILE,
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

    # ── Redis (ARQ job queue) ────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

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

    @field_validator("SITE_USE_PEXELS_STOCK", mode="before")
    @classmethod
    def _coerce_site_use_pexels(cls, v: object) -> object:
        # Azure peut envoyer SITE_USE_PEXELS_STOCK="" — éviter ValidationError au chargement.
        if v is None or (isinstance(v, str) and v.strip() == ""):
            return True
        if isinstance(v, str):
            return v.strip().lower() in ("1", "true", "yes", "on")
        return v

    # ── Google OAuth ──────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # ── Facebook OAuth ────────────────────────────────────────────────────
    FACEBOOK_APP_ID: str = ""
    FACEBOOK_APP_SECRET: str = ""

    # ── Google Gemini AI (Vertex AI SDK) ──────────────────────────────
    GOOGLE_API_KEY: str = ""
    GOOGLE_CLOUD_API_KEY: str = ""
    GOOGLE_CLOUD_PROJECT: str = ""
    GOOGLE_CLOUD_LOCATION: str = "us-central1"
    # Service account JSON for Vertex AI (used in Azure where no ADC file exists)
    GOOGLE_CREDENTIALS_JSON: str = ""
    # Chat sur Criar site (réponses courtes). Override via .env si besoin.
    GEMINI_TEXT_MODEL: str = "gemini-2.5-flash"
    # JSON « structure du site » au clic « Gerar site » (POST /sites/generate → worker). Pas le chat.
    GEMINI_SITE_GENERATION_MODEL: str = "gemini-3.1-pro-preview"

    # ── Pexels (stock photos for generated sites; https://www.pexels.com/api/) ─
    PEXELS_API_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("PEXELS_API_KEY", "PEXELS_TOKEN"),
    )
    # Azure / prod: set false to skip all Pexels HTTP calls during site generation (HTML unchanged otherwise).
    SITE_USE_PEXELS_STOCK: bool = True

    # ── Publish to GitHub (API-only; PAT needs repo + workflow scopes) ─────────
    GITHUB_TOKEN: str = ""
    GITHUB_OWNER: str = ""
    GCP_PROJECT_ID: str = ""
    # Service account JSON for Cloud Run deploy (from Actions). Plain JSON or base64-of-JSON in .env.
    GCP_SA_KEY: str = ""
    GCP_REGION: str = "us-central1"
    # After publish, poll Cloud Run API until the service URL exists (GitHub Actions deploy).
    CLOUD_RUN_POLL_MAX_SECONDS: int = 1200
    CLOUD_RUN_POLL_INTERVAL_SECONDS: int = 12
    # Après création du domain mapping GCP : poll jusqu'à Ready + enregistrements DNS.
    GCP_DOMAIN_MAPPING_POLL_MAX_SECONDS: int = 900
    GCP_DOMAIN_MAPPING_POLL_INTERVAL_SECONDS: int = 15

    # ── Cloudflare DNS (custom subdomain → Cloud Run via proxied CNAME) ───────
    CLOUDFLARE_TOKEN: str = ""
    CLOUDFLARE_ZONE_ID: str = ""
    CLOUDFLARE_ACCOUNT_ID: str = ""
    ROOT_DOMAIN: str = ""

    # ── Google Indexing API (after Publicar on subdomain; GCP SA + Search Console owner) ─
    GOOGLE_INDEXING_ENABLED: bool = True
    # Seconds to wait after enqueue (default 5400 = 1h30) before notifying Google.
    GOOGLE_INDEXING_DEFER_SECONDS: int = 5400

    @field_validator("GOOGLE_INDEXING_ENABLED", mode="before")
    @classmethod
    def _coerce_google_indexing_enabled(cls, v: object) -> object:
        if v is None or (isinstance(v, str) and v.strip() == ""):
            return True
        if isinstance(v, str):
            return v.strip().lower() in ("1", "true", "yes", "on")
        return v

    @field_validator("GOOGLE_INDEXING_DEFER_SECONDS", mode="before")
    @classmethod
    def _coerce_google_indexing_defer(cls, v: object) -> object:
        if v is None or (isinstance(v, str) and v.strip() == ""):
            return 5400
        return v

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
