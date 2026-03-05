"""Add Stripe columns to plans and subscriptions

Revision ID: 004
Revises: 003
Create Date: 2026-03-05 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Add stripe_price_id to plans ──────────────────────────────────────
    op.add_column(
        "plans",
        sa.Column("stripe_price_id", sa.String(255), nullable=True),
    )
    op.create_unique_constraint("uq_plans_stripe_price_id", "plans", ["stripe_price_id"])

    # ── Add Stripe columns to subscriptions ──────────────────────────────
    op.add_column(
        "subscriptions",
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("stripe_subscription_id", sa.String(255), nullable=True),
    )
    op.create_index(
        "ix_subscriptions_stripe_customer_id",
        "subscriptions",
        ["stripe_customer_id"],
    )
    op.create_index(
        "ix_subscriptions_stripe_subscription_id",
        "subscriptions",
        ["stripe_subscription_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_subscriptions_stripe_subscription_id", table_name="subscriptions")
    op.drop_index("ix_subscriptions_stripe_customer_id", table_name="subscriptions")
    op.drop_column("subscriptions", "stripe_subscription_id")
    op.drop_column("subscriptions", "stripe_customer_id")
    op.drop_constraint("uq_plans_stripe_price_id", "plans", type_="unique")
    op.drop_column("plans", "stripe_price_id")
