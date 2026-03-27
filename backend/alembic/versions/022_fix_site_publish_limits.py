"""Align site_publish_limit (starter 3, pro 6, business 30).

Révision attendue par certains environnements ; idempotent.
"""

from alembic import op


revision = "022_fix_site_publish_limits"
down_revision = "021_site_publish_quota"
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
