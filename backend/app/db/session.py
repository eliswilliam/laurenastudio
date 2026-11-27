import os
import ssl as _ssl

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.config import settings

# asyncpg supports ?ssl=require in the URL natively.
# For Azure PostgreSQL, also ensure ssl_context is provided for strict verification.
_connect_args: dict = {}
_url = settings.DATABASE_URL.lower()
_ssl_require_env = os.environ.get("DB_SSL_REQUIRE", "").lower() in ("1", "true", "yes")
if "azure" in _url or "ssl" in _url:
    _connect_args["ssl"] = _ssl.create_default_context()
elif _ssl_require_env:
    _connect_args["ssl"] = "require"

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncSession:
    """Dependency that provides an async database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
