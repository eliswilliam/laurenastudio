"""Add laurena_site_git_snapshots table

Revision ID: 030_git_snapshots
Revises: 029_site_projects_user_scope
Create Date: 2026-04-02 16:20:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "030_git_snapshots"
down_revision: Union[str, None] = "029_site_projects_user_scope"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "laurena_site_git_snapshots",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("commit_hash", sa.String(length=64), nullable=False),
        sa.Column("files_json", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["laurena_site_projects.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_laurena_site_git_snapshots_project_id",
        "laurena_site_git_snapshots",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_laurena_site_git_snapshots_commit_hash",
        "laurena_site_git_snapshots",
        ["commit_hash"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_laurena_site_git_snapshots_commit_hash", table_name="laurena_site_git_snapshots")
    op.drop_index("ix_laurena_site_git_snapshots_project_id", table_name="laurena_site_git_snapshots")
    op.drop_table("laurena_site_git_snapshots")
