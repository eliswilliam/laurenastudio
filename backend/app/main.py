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
from app.routes.posts import router as posts_router
from app.routes.social import router as social_router
from app.routes.ads import router as ads_router
from app.routes.analytics import router as analytics_router
from app.routes.webhook import router as webhook_router
from app.routes.workspaces import router as workspaces_router
from app.routes.search import router as search_router
from app.routes.media import router as media_router
from app.routes.data_deletion import router as deletion_router
from app.routes.marketing import router as marketing_router
from app.routes.laurena_code import router as laurena_code_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: nothing extra needed — Alembic handles migrations.
    yield
    # Shutdown cleanup (connection pool, etc.) can go here.


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Multi-tenant SaaS backend for Laurena Studio",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Middleware ─────────────────────────────────────────────────────────────
# SessionMiddleware must be added BEFORE CORSMiddleware so that session state
# is available when the OAuth callback arrives.
app.add_middleware(SessionMiddleware, secret_key=settings.SESSION_SECRET_KEY)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(posts_router, prefix="/api/v1")
app.include_router(social_router, prefix="/api/v1")
app.include_router(ads_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(webhook_router, prefix="/api/v1")
app.include_router(workspaces_router, prefix="/api/v1")
app.include_router(search_router, prefix="/api/v1")
app.include_router(media_router, prefix="/api/v1")
app.include_router(deletion_router, prefix="/api/v1")
app.include_router(marketing_router, prefix="/api/v1")
app.include_router(laurena_code_router, prefix="/api/v1")

# ── Static file serving (uploads) ────────────────────────────────────────────
_uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health() -> dict:
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
