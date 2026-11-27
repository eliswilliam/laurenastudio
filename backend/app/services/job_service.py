"""
job_service.py — single source of truth for `background_jobs` rows.
Workers and HTTP handlers must use these helpers; do not mutate BackgroundJob ad hoc in tasks.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.background_job import BackgroundJob


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def create_job(
    db: AsyncSession,
    *,
    job_type: str,
    user_id: str,
    project_id: str | None,
    input_payload: dict[str, Any] | None = None,
) -> BackgroundJob:
    job = BackgroundJob(
        id=uuid.uuid4(),
        job_type=job_type,
        status="pending",
        project_id=project_id,
        user_id=user_id,
        input_payload=input_payload,
        result=None,
        error=None,
        logs=[],
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(job)
    await db.flush()
    return job


async def get_job(db: AsyncSession, job_id: UUID | str) -> BackgroundJob | None:
    jid = UUID(str(job_id)) if not isinstance(job_id, UUID) else job_id
    result = await db.execute(select(BackgroundJob).where(BackgroundJob.id == jid))
    return result.scalars().first()


async def update_job_status(
    db: AsyncSession,
    job_id: UUID | str,
    status: str,
    *,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> BackgroundJob | None:
    job = await get_job(db, job_id)
    if not job:
        return None
    job.status = status
    job.updated_at = _now()
    if result is not None:
        job.result = result
    if error is not None:
        job.error = error
    await db.flush()
    return job


async def append_log(db: AsyncSession, job_id: UUID | str, message: str) -> None:
    job = await get_job(db, job_id)
    if not job:
        return
    logs = list(job.logs or [])
    logs.append({"ts": _now().isoformat(), "message": message})
    job.logs = logs
    job.updated_at = _now()
    flag_modified(job, "logs")
    await db.flush()


async def mark_running(db: AsyncSession, job_id: UUID | str) -> BackgroundJob | None:
    return await update_job_status(db, job_id, "running")


async def mark_success(
    db: AsyncSession,
    job_id: UUID | str,
    result: dict[str, Any],
) -> BackgroundJob | None:
    job = await get_job(db, job_id)
    if not job:
        return None
    job.status = "success"
    job.result = result
    job.error = None
    job.updated_at = _now()
    await db.flush()
    return job


async def mark_failed(
    db: AsyncSession,
    job_id: UUID | str,
    error_message: str,
) -> BackgroundJob | None:
    job = await get_job(db, job_id)
    if not job:
        return None
    job.status = "failed"
    job.error = error_message[:8000] if error_message else "Unknown error"
    job.updated_at = _now()
    await db.flush()
    return job
