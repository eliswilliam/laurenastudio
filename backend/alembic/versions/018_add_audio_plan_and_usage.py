"""Add audio_limit on plans and audio_used on usage_tracking.

Starter: 10/mo, Pro: 20/mo, Business: unlimited (0).
"""

from alembic import op
import sqlalchemy as sa


revision = "018_add_audio_limits"
down_revision = "017_remove_workspace_limit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "plans",
        sa.Column("audio_limit", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "usage_tracking",
        sa.Column("audio_used", sa.Integer(), nullable=False, server_default="0"),
    )

    op.execute("UPDATE plans SET audio_limit = 10 WHERE name = 'starter'")
    op.execute("UPDATE plans SET audio_limit = 20 WHERE name = 'pro'")
    op.execute("UPDATE plans SET audio_limit = 0 WHERE name = 'business'")

    op.alter_column("plans", "audio_limit", server_default=None)
    op.alter_column("usage_tracking", "audio_used", server_default=None)


def downgrade() -> None:
    op.drop_column("usage_tracking", "audio_used")
    op.drop_column("plans", "audio_limit")
