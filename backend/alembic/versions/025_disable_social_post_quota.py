"""Retirada do serviço posts sociais: post_limit = 0 para todos os planos (coluna conservada)."""

from alembic import op


revision = "025_disable_social_post_quota"
down_revision = "024_align_post_limit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE plans SET post_limit = 0")


def downgrade() -> None:
    op.execute("UPDATE plans SET post_limit = 50 WHERE name = 'starter'")
    op.execute("UPDATE plans SET post_limit = 500 WHERE name = 'pro'")
    op.execute("UPDATE plans SET post_limit = 0 WHERE name = 'business'")
