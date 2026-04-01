"""Add local Stripe subscription snapshot fields

Revision ID: 028_sub_snapshot_fields
Revises: 027_add_next_plan_schedule
Create Date: 2026-04-01 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "028_sub_snapshot_fields"
down_revision: Union[str, None] = "027_add_next_plan_schedule"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("billing_cycle", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "subscriptions",
        sa.Column("current_price_brl", sa.Float(), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("currency", sa.String(length=8), nullable=True),
    )

    op.execute(
        """
        UPDATE subscriptions
        SET billing_cycle = COALESCE(billing_cycle, 'monthly'),
            cancel_at_period_end = COALESCE(cancel_at_period_end, false),
            currency = COALESCE(currency, 'BRL')
        """
    )

    op.alter_column(
        "subscriptions",
        "cancel_at_period_end",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("subscriptions", "currency")
    op.drop_column("subscriptions", "current_price_brl")
    op.drop_column("subscriptions", "cancel_at_period_end")
    op.drop_column("subscriptions", "billing_cycle")
