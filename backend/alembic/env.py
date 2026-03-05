"""
Alembic env.py — synchronous migrations via pg8000 (pure-Python driver).
Works on Windows / Python 3.14 without asyncpg or encoding issues.
"""
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

# ── Ensure `app.*` imports resolve correctly ─────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# ── Import models (side-effect: registers all tables with Base.metadata) ─────
from app.db.base import Base  # noqa: E402
import app.models  # noqa: F401, E402

from app.core.config import settings  # noqa: E402

# ── Build a sync pg8000 URL from the async asyncpg URL ───────────────────────
SYNC_URL = settings.DATABASE_URL.replace(
    "postgresql+asyncpg://", "postgresql+pg8000://"
)

# ── Alembic config ────────────────────────────────────────────────────────────
config = context.config
config.set_main_option("sqlalchemy.url", SYNC_URL)

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
    engine = create_engine(SYNC_URL, echo=False)
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
