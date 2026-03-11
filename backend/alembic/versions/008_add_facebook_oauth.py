"""Add facebook_id to users

Revision ID: 008
Revises: 007
Create Date: 2026-03-11 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("facebook_id", sa.String(255), nullable=True),
    )
    op.create_index("ix_users_facebook_id", "users", ["facebook_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_facebook_id", table_name="users")
    op.drop_column("users", "facebook_id")
