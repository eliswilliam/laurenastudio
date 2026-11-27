"""
Dedicated async SQLAlchemy engine and session factory for ARQ worker processes.
Workers run in a separate process from FastAPI — do not use app.db.session here.
"""
from __future__ import annotations

import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


def _database_url() -> str:
    return os.environ.get("DATABASE_URL", "").strip() or (
        "postgresql+asyncpg://postgres:example@localhost:5432/laurenadb"
    )


def _connect_args() -> dict:
    url = _database_url().lower()
    ssl_require = os.environ.get("DB_SSL_REQUIRE", "").lower() in ("1", "true", "yes")
    if "azure" in url or ssl_require:
        return {"ssl": "require"}
    return {}


engine = create_async_engine(
    _database_url(),
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args=_connect_args(),
)

WorkerSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)
