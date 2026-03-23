"""
ARQ task: submit the published subdomain URL to Google Indexing API (deferred ~90 min after publish).
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.core.config import settings
from app.db.worker_db import WorkerSessionLocal
from app.models.site_project import SiteProject
from app.services.google_indexing_service import (
    publish_url_safe,
    resolve_subdomain_site_url,
)

logger = logging.getLogger(__name__)


async def _arq_google_index_site_impl(project_id: str, workspace_id: str) -> None:
    if not settings.GOOGLE_INDEXING_ENABLED:
        logger.info("google_index_site: disabled (GOOGLE_INDEXING_ENABLED=false)")
        return

    async with WorkerSessionLocal() as db:
        result = await db.execute(
            select(SiteProject).where(
                SiteProject.id == project_id,
                SiteProject.workspace_id == workspace_id,
            )
        )
        project = result.scalars().first()
        if not project:
            logger.warning(
                "google_index_site: project not found project_id=%s workspace=%s",
                project_id,
                workspace_id,
            )
            return

        url = resolve_subdomain_site_url(project.publish_slug)
        if not url:
            logger.warning(
                "google_index_site: no subdomain URL (slug/root) project_id=%s slug=%s",
                project_id,
                project.publish_slug,
            )
            return

    ok = await asyncio.to_thread(publish_url_safe, url)
    if ok:
        logger.info(
            "google_index_site: completed project_id=%s url=%s",
            project_id,
            url,
        )


async def arq_google_index_site(ctx: dict, project_id: str, workspace_id: str) -> None:
    """ARQ entrypoint: deferred job after Publicar (subdomain publish)."""
    try:
        await _arq_google_index_site_impl(project_id, workspace_id)
    except Exception:
        logger.exception(
            "google_index_site: unexpected error project_id=%s",
            project_id,
        )
