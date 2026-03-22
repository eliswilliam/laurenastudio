"""
ARQ worker process: run `arq app.workers.arq_worker.WorkerSettings` (see docker-compose).
"""
from __future__ import annotations

import os

from arq.connections import RedisSettings

from app.workers.generate_task import arq_generate_site
from app.workers.publish_task import arq_publish_site


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(
        os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    )
    functions = [arq_generate_site, arq_publish_site]
    max_jobs = 10
    job_timeout = 7200  # publish can exceed 1h
