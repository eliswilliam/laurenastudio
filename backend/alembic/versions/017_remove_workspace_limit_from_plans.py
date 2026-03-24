"""Remove workspace_limit from plans (feature removed from product)."""

from alembic import op
import sqlalchemy as sa


revision = "017_remove_workspace_limit"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("plans", "workspace_limit")


def downgrade() -> None:
    op.add_column(
        "plans",
        sa.Column(
            "workspace_limit",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )
    op.execute("UPDATE plans SET workspace_limit = 1 WHERE name = 'starter'")
    op.execute("UPDATE plans SET workspace_limit = 3 WHERE name = 'pro'")
    op.execute("UPDATE plans SET workspace_limit = 0 WHERE name = 'business'")
    op.alter_column("plans", "workspace_limit", server_default=None)
