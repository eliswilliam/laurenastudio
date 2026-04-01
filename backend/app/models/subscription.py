"""
models/subscription.py
Workspace subscription — links a workspace to a plan with status tracking.
Includes Stripe identifiers for real payment integration.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("plans.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="inactive"
    )  # "inactive" | "active" | "canceled" | "past_due"

    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Stripe identifiers ───────────────────────────────────────────────────
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True, index=True
    )

    # ── Scheduled plan change (downgrade at period end) ─────────────────────
    next_plan_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("plans.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    next_billing_cycle: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # ── Relationships ────────────────────────────────────────────────────────
    workspace: Mapped["Workspace"] = relationship(  # noqa: F821
        "Workspace", back_populates="subscription"
    )
    plan: Mapped["Plan"] = relationship(  # noqa: F821
        "Plan", back_populates="subscriptions", foreign_keys=[plan_id]
    )
    next_plan: Mapped["Plan | None"] = relationship(  # noqa: F821
        "Plan", foreign_keys=[next_plan_id]
    )

    def __repr__(self) -> str:
        return (
            "<Subscription "
            f"workspace={self.workspace_id} "
            f"plan={self.plan_id} "
            f"next_plan={self.next_plan_id} "
            f"status={self.status}>"
        )
