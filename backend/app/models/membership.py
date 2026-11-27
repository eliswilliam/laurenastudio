import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Membership(Base):
    __tablename__ = "memberships"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(
        String(50), nullable=False, default="member"
    )  # "admin" | "member"
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # ── Relationships ────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="memberships")  # noqa: F821
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="memberships")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Membership user={self.user_id} workspace={self.workspace_id} role={self.role}>"
