"""Helpers for publish slug uniqueness (relational check before deploy)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.site_project import SiteProject


async def is_publish_slug_taken(
    db: AsyncSession,
    slug: str,
    exclude_project_id: str | None = None,
) -> bool:
    """True if any project already owns this publish_slug."""
    slug = (slug or "").strip().lower()
    if not slug:
        return False

    stmt = select(SiteProject).where(SiteProject.publish_slug == slug)
    if exclude_project_id:
        stmt = stmt.where(SiteProject.id != exclude_project_id)

    r = await db.execute(stmt)
    return r.scalars().first() is not None


async def is_publish_slug_taken_by_other_project(
    db: AsyncSession,
    slug: str,
    project_id: str,
) -> bool:
    """
    True if another project already owns this publish_slug.
    Equivalent to a get_site_by_slug guard for 409 conflicts.
    """
    return await is_publish_slug_taken(db, slug, exclude_project_id=project_id)
