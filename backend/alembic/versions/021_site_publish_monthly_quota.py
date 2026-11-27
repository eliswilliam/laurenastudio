"""Monthly quota for POST /api/publish (site deploys).

Starter: 6 publishes / month
Pro: 30 publishes / month
Business: 0 limit column = unlimited (same convention as other resources)
"""

from alembic import op


revision = "021_site_publish_quota"
down_revision = "020_sync_plan_limits"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # IF NOT EXISTS: reprise sûre si une exécution partielle a déjà créé une colonne
    op.execute(
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS "
        "site_publish_limit INTEGER NOT NULL DEFAULT 0"
    )
    op.execute(
        "ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS "
        "site_publishes_used INTEGER NOT NULL DEFAULT 0"
    )
    op.execute("UPDATE plans SET site_publish_limit = 6 WHERE name = 'starter'")
    op.execute("UPDATE plans SET site_publish_limit = 30 WHERE name = 'pro'")
    op.execute("UPDATE plans SET site_publish_limit = 0 WHERE name = 'business'")
    op.execute("ALTER TABLE plans ALTER COLUMN site_publish_limit DROP DEFAULT")
    op.execute("ALTER TABLE usage_tracking ALTER COLUMN site_publishes_used DROP DEFAULT")


def downgrade() -> None:
    op.drop_column("usage_tracking", "site_publishes_used")
    op.drop_column("plans", "site_publish_limit")
