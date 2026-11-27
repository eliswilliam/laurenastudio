"""
background_job.py — durable async job records for ARQ workers (generate site, publish).
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.db.base import Base


class BackgroundJob(Base):
    """One row per long-running task; workers update status/logs/result via job_service only."""

    __tablename__ = "background_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_type = Column(String(32), nullable=False, index=True)
    status = Column(String(20), nullable=False, index=True)  # pending | running | success | failed

    project_id = Column(String(36), nullable=True, index=True)
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Optional serialized input (e.g. publish body) for worker replay after HTTP returns.
    input_payload = Column(JSONB, nullable=True)

    result = Column(JSONB, nullable=True)
    error = Column(Text, nullable=True)
    logs = Column(JSONB, nullable=False, default=list)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
