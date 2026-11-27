"""Switch laurena_site_projects scope from workspace to user

Revision ID: 029_site_projects_user_scope
Revises: 028_sub_snapshot_fields
Create Date: 2026-04-02 08:30:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "029_site_projects_user_scope"
down_revision: Union[str, None] = "028_sub_snapshot_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "laurena_site_projects",
        sa.Column("user_id", sa.String(length=36), nullable=True),
    )

    op.execute(
        sa.text(
            """
            UPDATE laurena_site_projects AS p
            SET user_id = w.owner_id
            FROM workspaces AS w
            WHERE p.workspace_id = w.id
            """
        )
    )

    op.alter_column("laurena_site_projects", "user_id", nullable=False)
    op.create_index(
        "ix_laurena_site_projects_user_id",
        "laurena_site_projects",
        ["user_id"],
    )
    op.create_foreign_key(
        "fk_laurena_site_projects_user_id_users",
        "laurena_site_projects",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.execute(
        sa.text(
            "ALTER TABLE laurena_site_projects DROP CONSTRAINT IF EXISTS laurena_site_projects_workspace_id_fkey"
        )
    )
    op.execute(sa.text("DROP INDEX IF EXISTS ix_laurena_site_projects_workspace_id"))
    op.drop_column("laurena_site_projects", "workspace_id")


def downgrade() -> None:
    op.add_column(
        "laurena_site_projects",
        sa.Column("workspace_id", sa.String(length=36), nullable=True),
    )

    op.execute(
        sa.text(
            """
            UPDATE laurena_site_projects AS p
            SET workspace_id = w.id
            FROM LATERAL (
                SELECT id
                FROM workspaces
                WHERE owner_id = p.user_id
                ORDER BY created_at ASC
                LIMIT 1
            ) AS w
            """
        )
    )

    op.alter_column("laurena_site_projects", "workspace_id", nullable=False)
    op.create_index(
        "ix_laurena_site_projects_workspace_id",
        "laurena_site_projects",
        ["workspace_id"],
    )
    op.create_foreign_key(
        "laurena_site_projects_workspace_id_fkey",
        "laurena_site_projects",
        "workspaces",
        ["workspace_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint(
        "fk_laurena_site_projects_user_id_users",
        "laurena_site_projects",
        type_="foreignkey",
    )
    op.drop_index("ix_laurena_site_projects_user_id", table_name="laurena_site_projects")
    op.drop_column("laurena_site_projects", "user_id")
