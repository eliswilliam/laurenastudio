"""Add plans, subscriptions, usage_tracking tables

Revision ID: 003
Revises: 002
Create Date: 2026-03-04 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── plans ──────────────────────────────────────────────────────────────
    op.create_table(
        "plans",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("price_brl", sa.Numeric(10, 2), nullable=False),
        sa.Column("text_limit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("image_limit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("video_limit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("social_limit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("post_limit", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_plans_id", "plans", ["id"])
    op.create_index("ix_plans_name", "plans", ["name"], unique=True)

    # ── Seed default plans ────────────────────────────────────────────────
    plans_table = sa.table(
        "plans",
        sa.column("id", sa.String),
        sa.column("name", sa.String),
        sa.column("display_name", sa.String),
        sa.column("price_brl", sa.Numeric),
        sa.column("text_limit", sa.Integer),
        sa.column("image_limit", sa.Integer),
        sa.column("video_limit", sa.Integer),
        sa.column("social_limit", sa.Integer),
        sa.column("post_limit", sa.Integer),
    )
    op.bulk_insert(
        plans_table,
        [
            {
                "id": "plan-starter-001",
                "name": "starter",
                "display_name": "Starter",
                "price_brl": 49.00,
                "text_limit": 50,
                "image_limit": 10,
                "video_limit": 0,
                "social_limit": 3,
                "post_limit": 30,
            },
            {
                "id": "plan-pro-001",
                "name": "pro",
                "display_name": "Pro",
                "price_brl": 129.00,
                "text_limit": 300,
                "image_limit": 100,
                "video_limit": 10,
                "social_limit": 10,
                "post_limit": 200,
            },
            {
                "id": "plan-business-001",
                "name": "business",
                "display_name": "Business",
                "price_brl": 349.00,
                "text_limit": 1500,
                "image_limit": 300,
                "video_limit": 50,
                "social_limit": 0,   # 0 = unlimited
                "post_limit": 0,     # 0 = unlimited
            },
        ],
    )

    # ── subscriptions ──────────────────────────────────────────────────────
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("plan_id", sa.String(36), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="inactive",
        ),
        sa.Column(
            "start_date",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["workspaces.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["plan_id"], ["plans.id"], ondelete="RESTRICT"
        ),
    )
    op.create_index("ix_subscriptions_id", "subscriptions", ["id"])
    op.create_index("ix_subscriptions_workspace_id", "subscriptions", ["workspace_id"])
    op.create_index("ix_subscriptions_plan_id", "subscriptions", ["plan_id"])

    # ── usage_tracking ─────────────────────────────────────────────────────
    op.create_table(
        "usage_tracking",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("text_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("image_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("video_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("posts_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["workspaces.id"], ondelete="CASCADE"
        ),
    )
    op.create_index("ix_usage_tracking_id", "usage_tracking", ["id"])
    op.create_index("ix_usage_tracking_workspace_id", "usage_tracking", ["workspace_id"])


def downgrade() -> None:
    op.drop_table("usage_tracking")
    op.drop_table("subscriptions")
    op.drop_table("plans")
