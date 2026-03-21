"""Helpers for publish slug uniqueness (relational check before deploy)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.site_project import SiteProject


async def is_publish_slug_taken_by_other_project(
    db: AsyncSession,
    slug: str,
    project_id: str,
) -> bool:
    """
    True if another project already owns this publish_slug.
    Equivalent to a get_site_by_slug guard for 409 conflicts.
    """
    slug = (slug or "").strip().lower()
    if not slug:
        return False
    r = await db.execute(
        select(SiteProject).where(
            SiteProject.publish_slug == slug,
            SiteProject.id != project_id,
        )
    )
    return r.scalars().first() is not None
