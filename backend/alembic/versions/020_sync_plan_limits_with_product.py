"""Align plan text/image/video limits with product copy (planos.ts).

Starter: 100 text, 50 image, 5 video (audio remains from 018: 10).
Pro: 300 text, 100 image, 20 video (audio 20 from 018).
Business: unlimited text/image (0), 100 video, unlimited audio (0 from 018).

video_limit 0 still means unlimited (see dependencies.check_and_increment_usage).
"""

from alembic import op


revision = "020_sync_plan_limits"
down_revision = "019_last_publish_enqueue"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE plans SET text_limit = 100, image_limit = 50, video_limit = 5
        WHERE name = 'starter'
        """
    )
    op.execute(
        """
        UPDATE plans SET text_limit = 300, image_limit = 100, video_limit = 20
        WHERE name = 'pro'
        """
    )
    op.execute(
        """
        UPDATE plans SET text_limit = 0, image_limit = 0, video_limit = 100
        WHERE name = 'business'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE plans SET text_limit = 50, image_limit = 10, video_limit = 0
        WHERE name = 'starter'
        """
    )
    op.execute(
        """
        UPDATE plans SET text_limit = 300, image_limit = 100, video_limit = 10
        WHERE name = 'pro'
        """
    )
    op.execute(
        """
        UPDATE plans SET text_limit = 1500, image_limit = 300, video_limit = 50
        WHERE name = 'business'
        """
    )
