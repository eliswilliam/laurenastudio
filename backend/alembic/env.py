"""
Alembic env.py — synchronous migrations via pg8000 (pure-Python driver).
Works on Windows / Python 3.14 without asyncpg or encoding issues.
"""
import os
import ssl
import sys
from logging.config import fileConfig
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

from alembic import context
from sqlalchemy import create_engine

# ── Ensure `app.*` imports resolve correctly ─────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# ── Import models (side-effect: registers all tables with Base.metadata) ─────
from app.db.base import Base  # noqa: E402
import app.models  # noqa: F401, E402

from app.core.config import settings  # noqa: E402

# ── Build a sync pg8000 URL from the async asyncpg URL ───────────────────────
_raw = settings.DATABASE_URL

# Replace the async driver with pg8000 (sync)
SYNC_URL = _raw.replace("postgresql+asyncpg://", "postgresql+pg8000://")

# Strip ?ssl=require from the URL — pg8000 handles SSL via connect_args
_parsed = urlparse(SYNC_URL)
_params = parse_qs(_parsed.query)
_need_ssl = "ssl" in _params
_params.pop("ssl", None)
_clean_query = urlencode(_params, doseq=True)
SYNC_URL = urlunparse(_parsed._replace(query=_clean_query))

# pg8000 requires an ssl.SSLContext object, not a query-string flag
_connect_args: dict = {}
if _need_ssl or "azure" in SYNC_URL.lower():
    _connect_args["ssl_context"] = ssl.create_default_context()

print(f"[alembic env] sync driver ready, ssl={'yes' if _connect_args else 'no'}")

# ── Alembic config ────────────────────────────────────────────────────────────
config = context.config
# Do NOT use config.set_main_option("sqlalchemy.url", ...) because configparser
# chokes on '%' characters in the URL (e.g. %24 for '$' in passwords).
# Instead, pass SYNC_URL directly to create_engine / context.configure.

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# ── Offline mode (generate SQL only, no live DB) ──────────────────────────────
def run_migrations_offline() -> None:
    context.configure(
        url=SYNC_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online mode (apply directly to DB) ───────────────────────────────────────
def run_migrations_online() -> None:
    engine = create_engine(SYNC_URL, echo=False, connect_args=_connect_args)
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
