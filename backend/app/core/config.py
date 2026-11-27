import json
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator, model_validator
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
    APP_ENV: str = "development"
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

    # ── Legacy Groq settings (kept for backward compatibility) ───────────────
    GROQ_API_KEY: str = ""
    GROQ_SITE_CHAT_MODEL: str = "openai/gpt-oss-20b"
    GROQ_SITE_STRUCTURE_MODEL: str = "openai/gpt-oss-20b"

    # ── Replicate (Criar site text + video generation tasks) ─────────────────
    REPLICATE_API_TOKEN: str = ""
    REPLICATE_SITE_CHAT_MODEL: str = "meta/meta-llama-3-8b-instruct"
    REPLICATE_SITE_STRUCTURE_MODEL: str = "meta/meta-llama-3-8b-instruct"

    # ── Anthropic Claude (Novidade streaming site builder) ──────────────────
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-3-7-sonnet-20250219"
    ANTHROPIC_MAX_TOKENS: int = 8000

    # ── Novidade builder (Gemini streaming via google-genai SDK) ───────────
    NOVIDADE_GEMINI_MODEL: str = "gemini-2.5-flash-lite"
    NOVIDADE_GEMINI_MAX_OUTPUT_TOKENS: int = 65535

    # ── Pexels (stock photos for generated sites; https://www.pexels.com/api/) ─
    PEXELS_API_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("PEXELS_API_KEY", "PEXELS_TOKEN"),
    )
    # Azure / prod: set false to skip all Pexels HTTP calls during site generation (HTML unchanged otherwise).
    SITE_USE_PEXELS_STOCK: bool = True

    # ── Publish to GitHub (API-only; PAT needs repo + workflow scopes) ─────────
    GITHUB_TOKEN: str = ""
    # Optional dedicated token for repository deletion (needs delete_repo/admin rights).
    # If empty, deletion reuses GITHUB_TOKEN.
    GITHUB_DELETE_TOKEN: str = ""
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
    AUTH_ACCESS_COOKIE_NAME: str = "ls_access_token"
    AUTH_REFRESH_COOKIE_NAME: str = "ls_refresh_token"
    AUTH_COOKIE_SAMESITE: str = "strict"

    # ── reCAPTCHA v3 ─────────────────────────────────────────────────────────
    RECAPTCHA_SECRET_KEY: str = ""
    # SECURITY: enabled by default. Set RECAPTCHA_ENABLED=false only for local
    # dev/testing (handled automatically by APP_ENV). In production, the server
    # will refuse to start if this is True but RECAPTCHA_SECRET_KEY is missing.
    RECAPTCHA_ENABLED: bool = True
    RECAPTCHA_LOGIN_THRESHOLD: float = 0.7

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
    # Legacy Price IDs (fallback if cycle-specific IDs are not set)
    STRIPE_PRICE_ID_STARTER: str = ""
    STRIPE_PRICE_ID_PRO: str = ""
    STRIPE_PRICE_ID_BUSINESS: str = ""

    # Price IDs by billing cycle
    STRIPE_PRICE_ID_STARTER_MONTHLY: str = ""
    STRIPE_PRICE_ID_PRO_MONTHLY: str = ""
    STRIPE_PRICE_ID_BUSINESS_MONTHLY: str = ""
    STRIPE_PRICE_ID_STARTER_ANNUAL: str = ""
    STRIPE_PRICE_ID_PRO_ANNUAL: str = ""
    STRIPE_PRICE_ID_BUSINESS_ANNUAL: str = ""

    # ── Azure Cognitive Services — Speech (text-to-speech) ───────────────────
    # Key + endpoint from Azure Portal (Speech resource). Never commit real keys.
    AZURE_SPEECH_KEY: str = ""
    AZURE_SPEECH_ENDPOINT: str = ""
    AZURE_SPEECH_VOICE: str = "en-US-Ava:DragonHDLatestNeural"

    # ── OAuth2 Authorization Server (Builder subdomain) ──────────────────
    # URL of the builder subdomain (used in whitelist + CORS)
    BUILDER_URL: str = "http://localhost:2020"
    # Shared secret between FastAPI (/oauth/token) and the Next.js backend.
    # Generate with: openssl rand -hex 32
    OAUTH_TOKEN_SECRET: str = "CHANGE-ME-oauth-token-secret-use-openssl-rand-hex-32"
    # Comma-separated list of allowed redirect_uri values for /oauth/authorize
    OAUTH_ALLOWED_REDIRECT_URIS: str = "http://localhost:2020/auth/callback"

    # ── CORS ─────────────────────────────────────────────────────────────
    # Stored as a comma-separated string for env-var compatibility
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080"

    @property
    def allowed_origins_list(self) -> list[str]:
        """Parse ALLOWED_ORIGINS into a list (supports JSON array or comma-separated).
        Always includes BUILDER_URL so the subdomain can call the API."""
        val = self.ALLOWED_ORIGINS
        try:
            parsed = json.loads(val)
            if isinstance(parsed, list):
                origins = list(parsed)
            else:
                origins = [o.strip() for o in val.split(",") if o.strip()]
        except (json.JSONDecodeError, TypeError):
            origins = [o.strip() for o in val.split(",") if o.strip()]
        if self.BUILDER_URL and self.BUILDER_URL not in origins:
            origins.append(self.BUILDER_URL)
        return origins

    @model_validator(mode="after")
    def _fail_fast_for_default_secrets(self) -> "Settings":
        env = (self.APP_ENV or "").strip().lower()
        is_dev_like = env in {"dev", "development", "local", "test", "testing"}
        if self.DEBUG or is_dev_like:
            return self

        default_secrets = {
            "SECRET_KEY": "CHANGE-ME-in-production-use-openssl-rand-hex-32",
            "SESSION_SECRET_KEY": "CHANGE-ME-session-secret-use-openssl-rand-hex-32",
            # SECURITY: OAUTH_TOKEN_SECRET protects the server-to-server OAuth code exchange.
            # A default value would let anyone call /api/v1/oauth/token and steal user sessions.
            "OAUTH_TOKEN_SECRET": "CHANGE-ME-oauth-token-secret-use-openssl-rand-hex-32",
        }
        unsafe = [
            key for key, default in default_secrets.items() if str(getattr(self, key, "")).strip() == default
        ]
        if unsafe:
            names = ", ".join(unsafe)
            raise ValueError(
                f"Refusing to start in non-dev environment with default secrets: {names}."
            )

        # SECURITY: reCAPTCHA is the primary brute-force protection for login/register.
        # In production it must be properly configured — refuse to start if enabled
        # but the secret key is missing, so the misconfiguration fails loudly at
        # startup rather than silently at request time (500 on every login attempt).
        if self.RECAPTCHA_ENABLED and not self.RECAPTCHA_SECRET_KEY.strip():
            raise ValueError(
                "RECAPTCHA_ENABLED=true in production but RECAPTCHA_SECRET_KEY is empty. "
                "Set RECAPTCHA_SECRET_KEY or set RECAPTCHA_ENABLED=false to disable reCAPTCHA."
            )

        return self


settings = Settings()
