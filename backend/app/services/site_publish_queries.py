"""Helpers for publish slug uniqueness (relational check before deploy)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.site_project import SiteDeployment, SiteProject


async def is_publish_slug_taken(
    db: AsyncSession,
    slug: str,
    exclude_project_id: str | None = None,
) -> bool:
    """True if any project/deployment already uses this slug."""
    slug = (slug or "").strip().lower()
    if not slug:
        return False

    project_stmt = select(SiteProject.id).where(SiteProject.publish_slug == slug)
    if exclude_project_id:
        project_stmt = project_stmt.where(SiteProject.id != exclude_project_id)

    project_res = await db.execute(project_stmt)
    if project_res.scalar_one_or_none() is not None:
        return True

    deployment_stmt = select(SiteDeployment.id).where(SiteDeployment.slug == slug)
    if exclude_project_id:
        deployment_stmt = deployment_stmt.where(SiteDeployment.project_id != exclude_project_id)

    deployment_res = await db.execute(deployment_stmt)
    return deployment_res.scalar_one_or_none() is not None


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
