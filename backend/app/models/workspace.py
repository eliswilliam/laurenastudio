import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # ── Relationships ────────────────────────────────────────────────────────
    owner: Mapped["User"] = relationship("User", back_populates="workspaces")  # noqa: F821
    memberships: Mapped[list["Membership"]] = relationship(  # noqa: F821
        "Membership", back_populates="workspace", cascade="all, delete-orphan"
    )
    subscription: Mapped["Subscription | None"] = relationship(  # noqa: F821
        "Subscription", back_populates="workspace", uselist=False, cascade="all, delete-orphan"
    )
    usage_tracking: Mapped["UsageTracking | None"] = relationship(  # noqa: F821
        "UsageTracking", back_populates="workspace", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Workspace id={self.id} name={self.name}>"
