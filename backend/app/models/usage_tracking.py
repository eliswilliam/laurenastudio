"""
models/usage_tracking.py
Monthly resource usage counters per workspace.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UsageTracking(Base):
    __tablename__ = "usage_tracking"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Counters ─────────────────────────────────────────────────────────────
    text_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    image_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    video_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    posts_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    audio_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # ── Billing period ───────────────────────────────────────────────────────
    period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    period_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # ── Relationships ────────────────────────────────────────────────────────
    workspace: Mapped["Workspace"] = relationship(  # noqa: F821
        "Workspace", back_populates="usage_tracking"
    )

    def __repr__(self) -> str:
        return (
            f"<UsageTracking workspace={self.workspace_id} "
            f"text={self.text_used} img={self.image_used} "
            f"vid={self.video_used} posts={self.posts_used} "
            f"audio={self.audio_used}>"
        )
