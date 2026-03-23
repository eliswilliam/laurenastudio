"""
ARQ worker process: run `arq app.workers.arq_worker.WorkerSettings` (see docker-compose).
"""
from __future__ import annotations

import logging
import os
import time

from sqlalchemy import update

from app.db.worker_db import WorkerSessionLocal
from app.models.background_job import BackgroundJob
from app.redis_arq_settings import build_redis_settings
from app.workers.ai_video_task import arq_ai_video
from app.workers.generate_task import arq_generate_site
from app.workers.google_indexing_task import arq_google_index_site
from app.workers.publish_task import arq_publish_site

logger = logging.getLogger(__name__)


def _sync_wait_for_redis() -> None:
    """Ping Redis before ARQ create_pool (import-time). Logs each attempt."""
    import ssl as ssl_lib

    import redis as sync_redis

    raw = os.environ.get("REDIS_URL", "").strip() or "redis://localhost:6379/0"
    _ssl_kw: dict = {}
    if raw.lower().startswith("rediss://"):
        _ssl_kw["ssl_cert_reqs"] = ssl_lib.CERT_NONE
    for attempt in range(1, 11):
        try:
            client = sync_redis.from_url(
                raw,
                socket_connect_timeout=10,
                decode_responses=False,
                **_ssl_kw,
            )
            client.ping()
            client.close()
            logger.info("Redis reachable (attempt %s/10)", attempt)
            return
        except Exception as exc:
            logger.warning(
                "Redis ping attempt %s/10 failed: %s: %s",
                attempt,
                type(exc).__name__,
                exc,
            )
            print(
                f"[arq_worker] Redis ping attempt {attempt}/10 failed: {exc}",
                flush=True,
            )
            if attempt == 10:
                raise RuntimeError(
                    "Redis unavailable after 10 attempts (30s total wait)"
                ) from exc
            time.sleep(3)


_sync_wait_for_redis()


async def startup(ctx: dict) -> None:
    """Runs after ARQ pool is created; confirm connectivity."""
    redis = ctx.get("redis")
    if redis is not None:
        await redis.ping()
    logger.info("ARQ worker on_startup complete")


async def shutdown(ctx: dict) -> None:
    """
    Graceful shutdown: stale running rows (no heartbeat) go back to pending for retry.
    """
    from datetime import datetime, timedelta, timezone

    cutoff = datetime.now(timezone.utc) - timedelta(seconds=30)
    logger.info("ARQ on_shutdown: resetting stale running jobs (updated_at < %s)", cutoff)
    async with WorkerSessionLocal() as db:
        await db.execute(
            update(BackgroundJob)
            .where(
                BackgroundJob.status == "running",
                BackgroundJob.updated_at < cutoff,
            )
            .values(
                status="pending",
                error=None,
                updated_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()
    logger.info("ARQ on_shutdown: stale jobs reset to pending")


class WorkerSettings:
    redis_settings = build_redis_settings()
    functions = [arq_generate_site, arq_publish_site, arq_ai_video, arq_google_index_site]
    max_jobs = 10
    job_timeout = 7200
    on_startup = startup
    on_shutdown = shutdown
