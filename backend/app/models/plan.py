"""
models/plan.py
SaaS plan definitions — Starter, Pro, Business.
"""
import uuid

from sqlalchemy import Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True
    )
    name: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )  # "starter" | "pro" | "business"
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    price_brl: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False
    )

    # ── Stripe ────────────────────────────────────────────────────────────────
    stripe_price_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True
    )

    # ── Resource limits ──────────────────────────────────────────────────────
    text_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    image_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    video_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    social_limit: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )  # 0 = unlimited
    post_limit: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )  # 0 = unlimited
    audio_limit: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )  # 0 = unlimited (e.g. Business)
    site_publish_limit: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )  # 0 = unlimited; otherwise max POST /api/publish per billing month

    # ── Relationships ────────────────────────────────────────────────────────
    subscriptions: Mapped[list["Subscription"]] = relationship(  # noqa: F821
        "Subscription",
        back_populates="plan",
        cascade="all, delete-orphan",
        foreign_keys="Subscription.plan_id",
    )

    def __repr__(self) -> str:
        return f"<Plan name={self.name} price={self.price_brl}>"
