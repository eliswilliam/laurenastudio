"""Re-apply site_publish_limit 3 / 6 / 30 if 022 was stamped without SQL."""

from alembic import op


revision = "023_site_publish_limits_33630"
down_revision = "022_fix_site_publish_limits"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE plans SET site_publish_limit = 3 WHERE name = 'starter'")
    op.execute("UPDATE plans SET site_publish_limit = 6 WHERE name = 'pro'")
    op.execute("UPDATE plans SET site_publish_limit = 30 WHERE name = 'business'")


def downgrade() -> None:
    op.execute("UPDATE plans SET site_publish_limit = 6 WHERE name = 'starter'")
    op.execute("UPDATE plans SET site_publish_limit = 30 WHERE name = 'pro'")
    op.execute("UPDATE plans SET site_publish_limit = 0 WHERE name = 'business'")
