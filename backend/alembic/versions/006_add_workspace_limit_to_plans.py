"""Add workspace_limit column to plans table

Revision ID: 006
Revises: 005
Create Date: 2026-03-08 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "plans",
        sa.Column("workspace_limit", sa.Integer(), nullable=False, server_default="1"),
    )
    # Set default values per plan name
    op.execute("UPDATE plans SET workspace_limit = 1 WHERE name = 'starter'")
    op.execute("UPDATE plans SET workspace_limit = 3 WHERE name = 'pro'")
    op.execute("UPDATE plans SET workspace_limit = 0 WHERE name = 'business'")  # 0 = unlimited


def downgrade() -> None:
    op.drop_column("plans", "workspace_limit")
