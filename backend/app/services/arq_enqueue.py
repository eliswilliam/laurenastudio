"""Lazy ARQ connection pool for enqueueing jobs from FastAPI (same Redis as workers)."""

from __future__ import annotations

import logging
from datetime import timedelta

from arq import create_pool
from arq.connections import ArqRedis

from app.core.config import settings
from app.redis_arq_settings import build_redis_settings

logger = logging.getLogger(__name__)

_pool: ArqRedis | None = None


async def get_arq_pool() -> ArqRedis:
    global _pool
    if _pool is None:
        _pool = await create_pool(build_redis_settings())
        logger.info("ARQ pool connected to %s", settings.REDIS_URL.split("@")[-1])
    return _pool


async def close_arq_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def enqueue_generate_job(job_id: str) -> None:
    redis = await get_arq_pool()
    await redis.enqueue_job("arq_generate_site", job_id)


async def enqueue_publish_job(job_id: str) -> None:
    redis = await get_arq_pool()
    await redis.enqueue_job("arq_publish_site", job_id)


async def enqueue_delete_published_site_job(job_id: str) -> None:
    redis = await get_arq_pool()
    await redis.enqueue_job("arq_delete_published_site", job_id)


async def enqueue_ai_video_job(job_id: str) -> None:
    redis = await get_arq_pool()
    await redis.enqueue_job("arq_ai_video", job_id)


