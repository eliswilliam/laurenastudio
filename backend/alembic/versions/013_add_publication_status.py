"""Add publication_status on laurena_site_projects (publishing / live / failed).

Revision ID: 013
Revises: 012
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "laurena_site_projects",
        sa.Column("publication_status", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("laurena_site_projects", "publication_status")
