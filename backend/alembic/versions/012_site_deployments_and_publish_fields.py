"""Site deployments history + publish fields on laurena_site_projects.

Revision ID: 012
Revises: 011
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "laurena_site_projects",
        sa.Column("github_repo_url", sa.String(500), nullable=True),
    )
    op.add_column(
        "laurena_site_projects",
        sa.Column("cloud_run_url", sa.String(500), nullable=True),
    )
    op.add_column(
        "laurena_site_projects",
        sa.Column("cloud_run_service_name", sa.String(255), nullable=True),
    )
    op.add_column(
        "laurena_site_projects",
        sa.Column("site_url", sa.String(500), nullable=True),
    )
    op.add_column(
        "laurena_site_projects",
        sa.Column("user_prompt", sa.Text(), nullable=True),
    )

    op.create_table(
        "laurena_site_deployments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(36),
            sa.ForeignKey("laurena_site_projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("slug", sa.String(64), nullable=True),
        sa.Column("github_repo_url", sa.String(500), nullable=True),
        sa.Column("cloud_run_service_name", sa.String(255), nullable=True),
        sa.Column("cloud_run_url", sa.String(500), nullable=True),
        sa.Column("site_url", sa.String(500), nullable=True),
        sa.Column("commit_sha", sa.String(64), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_laurena_site_deployments_project_created",
        "laurena_site_deployments",
        ["project_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_laurena_site_deployments_project_created", table_name="laurena_site_deployments")
    op.drop_table("laurena_site_deployments")
    op.drop_column("laurena_site_projects", "user_prompt")
    op.drop_column("laurena_site_projects", "site_url")
    op.drop_column("laurena_site_projects", "cloud_run_service_name")
    op.drop_column("laurena_site_projects", "cloud_run_url")
    op.drop_column("laurena_site_projects", "github_repo_url")
