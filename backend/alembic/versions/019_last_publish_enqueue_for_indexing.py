"""Track last Publicar click for Google Indexing eligibility (defer GOOGLE_INDEXING_DEFER_SECONDS).

Indexing is manual from /indexar after the wait; optional backfill from latest deployment.
"""

from alembic import op
import sqlalchemy as sa


revision = "019_last_publish_enqueue"
down_revision = "018_add_audio_limits"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "laurena_site_projects",
        sa.Column(
            "last_publish_enqueue_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    # Backfill: último clique em Publicar ≈ deployment mais recente
    op.execute(
        """
        UPDATE laurena_site_projects p
        SET last_publish_enqueue_at = sub.mx
        FROM (
            SELECT project_id, MAX(created_at) AS mx
            FROM laurena_site_deployments
            GROUP BY project_id
        ) sub
        WHERE p.id = sub.project_id
          AND p.last_publish_enqueue_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("laurena_site_projects", "last_publish_enqueue_at")
