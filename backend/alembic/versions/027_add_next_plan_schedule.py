"""Add scheduled next plan fields to subscriptions

Revision ID: 027_add_next_plan_schedule
Revises: 026_sub_plan_transition
Create Date: 2026-04-01 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "027_add_next_plan_schedule"
down_revision: Union[str, None] = "026_sub_plan_transition"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("next_plan_id", sa.String(36), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("next_billing_cycle", sa.String(20), nullable=True),
    )
    op.create_index(
        "ix_subscriptions_next_plan_id",
        "subscriptions",
        ["next_plan_id"],
    )
    op.create_foreign_key(
        "fk_subscriptions_next_plan_id",
        "subscriptions",
        "plans",
        ["next_plan_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_subscriptions_next_plan_id",
        "subscriptions",
        type_="foreignkey",
    )
    op.drop_index("ix_subscriptions_next_plan_id", table_name="subscriptions")
    op.drop_column("subscriptions", "next_billing_cycle")
    op.drop_column("subscriptions", "next_plan_id")
