"""
main.py — Laurena Studio API entry point
"""
import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Python 3.14 / Windows: ProactorEventLoop breaks asyncpg over Docker networks.
# Force SelectorEventLoop before any asyncio code runs.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import settings
from app.routes.auth import router as auth_router
from app.routes.billing import router as billing_router
from app.routes.ai import router as ai_router
from app.routes.speech import router as speech_router
from app.routes.social import router as social_router
from app.routes.ads import router as ads_router
from app.routes.analytics import router as analytics_router
from app.routes.webhook import router as webhook_router
from app.routes.search import router as search_router
from app.routes.media import router as media_router
from app.routes.data_deletion import router as deletion_router
from app.routes.marketing import router as marketing_router
from app.routes.sites import router as sites_router
from app.routes.publish import router as publish_router
from app.routes.notifications import router as notifications_router
from app.routes.novidade import router as novidade_router
from app.routes.oauth import router as oauth_router
from app.routes.builder import router as builder_router
from app.services.arq_enqueue import close_arq_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_arq_pool()


# SECURITY: Swagger UI and ReDoc are only available in development.
# In production, they expose the full API schema (endpoints, parameters, models)
# to anyone — disable them to reduce the attack surface.
_is_dev_env = settings.DEBUG or (settings.APP_ENV or "").strip().lower() in {
    "dev", "development", "local", "test", "testing"
}

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Multi-tenant SaaS backend for Laurena Studio",
    docs_url="/docs" if _is_dev_env else None,
    redoc_url="/redoc" if _is_dev_env else None,
    lifespan=lifespan,
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)

    csp = (
        "default-src 'self'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'; "
        "form-action 'self'; "
        "script-src 'self' 'unsafe-inline' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https: wss:; "
        "frame-src 'self' https://www.google.com/recaptcha/"
    )

    response.headers["Content-Security-Policy"] = csp
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    # HSTS toujours présent (le reverse proxy Azure/Nginx en amont gère le HTTPS)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

    return response

# ── Middleware ─────────────────────────────────────────────────────────────
# SessionMiddleware must be added BEFORE CORSMiddleware so that session state
# is available when the OAuth callback arrives.
app.add_middleware(SessionMiddleware, secret_key=settings.SESSION_SECRET_KEY)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    # SECURITY: méthodes et headers explicites — jamais ["*"] avec allow_credentials=True
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-Workspace-Id"],
    expose_headers=["Content-Length", "X-Request-Id"],
    max_age=600,
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(speech_router, prefix="/api/v1")
app.include_router(social_router, prefix="/api/v1")
app.include_router(ads_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(webhook_router, prefix="/api/v1")
app.include_router(search_router, prefix="/api/v1")
app.include_router(media_router, prefix="/api/v1")
app.include_router(deletion_router, prefix="/api/v1")
app.include_router(marketing_router, prefix="/api/v1")
app.include_router(sites_router, prefix="/api/v1")
app.include_router(novidade_router, prefix="/api/v1")
app.include_router(oauth_router, prefix="/api/v1")
app.include_router(builder_router, prefix="/api/v1")
app.include_router(publish_router, prefix="/api")
app.include_router(notifications_router, prefix="/api/v1")

# ── Static file serving (uploads) ────────────────────────────────────────────
_uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health() -> dict:
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
