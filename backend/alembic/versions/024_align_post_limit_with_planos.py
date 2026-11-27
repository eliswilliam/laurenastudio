"""Align post_limit (posts sociais /api/posts) with planos.ts limites.postsmes.

starter: 50 | pro: 500 | business: 0 = ilimitado
"""

from alembic import op


revision = "024_align_post_limit"
down_revision = "023_site_publish_limits_33630"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE plans SET post_limit = 50 WHERE name = 'starter'")
    op.execute("UPDATE plans SET post_limit = 500 WHERE name = 'pro'")
    op.execute("UPDATE plans SET post_limit = 0 WHERE name = 'business'")


def downgrade() -> None:
    op.execute("UPDATE plans SET post_limit = 30 WHERE name = 'starter'")
    op.execute("UPDATE plans SET post_limit = 200 WHERE name = 'pro'")
