"""
Shared ARQ RedisSettings builder for API (enqueue) and worker processes.
Supports redis:// and rediss:// (Azure Cache for Redis), retry_on_timeout.
"""
from __future__ import annotations

import os
from urllib.parse import unquote, urlparse

from arq.connections import RedisSettings


def build_redis_settings() -> RedisSettings:
    """
    Build RedisSettings from REDIS_URL (required in production / Azure).
    Never hardcode host: use env only.
    """
    raw = os.environ.get("REDIS_URL", "redis://localhost:6379/0").strip()
    if not raw:
        raw = "redis://localhost:6379/0"

    parsed = urlparse(raw)
    scheme = (parsed.scheme or "redis").lower()
    use_ssl = scheme == "rediss"

    host = parsed.hostname or "localhost"
    port = parsed.port or (6380 if use_ssl else 6379)

    username = unquote(parsed.username) if parsed.username else None
    password = unquote(parsed.password) if parsed.password else None
    if username == "":
        username = None

    db_path = (parsed.path or "/0").strip("/")
    try:
        database = int(db_path) if db_path else 0
    except ValueError:
        database = 0

    # ARQ passes ssl_cert_reqs through to redis-py; use string form.
    ssl_cert_reqs = "none" if use_ssl else "required"

    return RedisSettings(
        host=host,
        port=port,
        username=username,
        password=password,
        database=database,
        ssl=use_ssl,
        ssl_cert_reqs=ssl_cert_reqs,
        retry_on_timeout=True,
        conn_retries=10,
        conn_retry_delay=3,
    )
