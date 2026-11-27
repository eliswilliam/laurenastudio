"""Compatibility placeholder for missing historical revision.

Revision ID: 026_sub_plan_transition
Revises: 025_disable_social_post_quota
Create Date: 2026-04-01 00:00:00.000000
"""
from typing import Sequence, Union


revision: str = "026_sub_plan_transition"
down_revision: Union[str, None] = "025_disable_social_post_quota"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Historical migration not present in this checkout.
    # Keep as no-op to preserve Alembic upgrade continuity.
    return


def downgrade() -> None:
    return
