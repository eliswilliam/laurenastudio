"""Add publish_slug for custom subdomain (Cloudflare) uniqueness.

Revision ID: 011
Revises: 010
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "laurena_site_projects",
        sa.Column("publish_slug", sa.String(64), nullable=True),
    )
    op.create_unique_constraint(
        "uq_laurena_site_projects_publish_slug",
        "laurena_site_projects",
        ["publish_slug"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_laurena_site_projects_publish_slug",
        "laurena_site_projects",
        type_="unique",
    )
    op.drop_column("laurena_site_projects", "publish_slug")
