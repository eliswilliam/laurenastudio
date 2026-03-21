"""Laurena Criar site: dedicated tables (avoid legacy site_projects owner_id schema)

Revision ID: 010
Revises: 009
Create Date: 2026-03-20

Legacy DBs may have site_projects(owner_id → users) from older code. Our builder uses
workspace_id → workspaces; we store it in laurena_site_* tables.

If migration 009 had created site_projects with workspace_id, drop those orphan tables
before creating laurena_*.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    r = conn.execute(
        sa.text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'site_projects'
              AND column_name = 'workspace_id'
            """
        )
    )
    if r.scalar():
        op.execute(
            sa.text("DROP TABLE IF EXISTS generated_sites CASCADE")
        )
        op.execute(sa.text("DROP TABLE IF EXISTS site_prompts CASCADE"))
        op.execute(sa.text("DROP TABLE IF EXISTS site_projects CASCADE"))

    op.create_table(
        "laurena_site_projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.String(36),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False, server_default="Novo site"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "laurena_site_prompts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(36),
            sa.ForeignKey("laurena_site_projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("model_used", sa.String(100), nullable=True),
        sa.Column("tokens_used", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "laurena_generated_sites",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(36),
            sa.ForeignKey("laurena_site_projects.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        ),
        sa.Column("structure_json", sa.Text, nullable=True),
        sa.Column("html_path", sa.String(500), nullable=True),
        sa.Column("preview_url", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("laurena_generated_sites")
    op.drop_table("laurena_site_prompts")
    op.drop_table("laurena_site_projects")
