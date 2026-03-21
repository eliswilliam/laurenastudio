"""
POST /api/publish — create GitHub repo, single git commit, Actions secrets (GCP),
optional Cloudflare CNAME → custom subdomain. Persists SiteDeployment + SiteProject fields.
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_workspace_id, verify_active_subscription
from app.db.session import get_db
from app.models.site_project import SiteDeployment, SiteProject
from app.models.subscription import Subscription
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.publish import PublishRequest, PublishResponse
from app.core.config import settings
from app.services.cloud_run_lookup import wait_for_cloud_run_url
from app.services.cloud_run_domain_mapping import DomainMappingError, ensure_mapped_domain_and_cloudflare_dns
from app.services.dns_service import DnsError, dns_configured, validate_slug
from app.services.github_publish_service import GitHubPublishError, publish_site_files
from app.services.site_generator import SITES_DIR
from app.services.site_publish_queries import is_publish_slug_taken_by_other_project
from app.services.site_static_bundle import split_html_to_static_files

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Publish"])


@router.get("/publish/config", summary="Indique si le slug est obligatoire (Cloudflare configuré)")
async def publish_config() -> dict[str, bool]:
    """Aligne le frontend sur le backend sans variable VITE dupliquée."""
    return {"requireSlug": dns_configured()}


def _normalize_paths(files: list) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for f in files:
        p = (f.path or "").strip().replace("\\", "/").lstrip("/")
        if not p or p.startswith("..") or "/../" in f"/{p}/":
            continue
        out.append((p, f.content or ""))
    return out


def _http_detail_str(detail: object) -> str:
    if isinstance(detail, str):
        return detail[:4000]
    if isinstance(detail, list):
        try:
            return json.dumps(detail, ensure_ascii=False)[:4000]
        except Exception:
            return str(detail)[:4000]
    try:
        return str(detail)[:4000]
    except Exception:
        return "error"


@router.post("/publish", response_model=PublishResponse, summary="Publish generated site to GitHub (single commit)")
async def publish_site(
    payload: PublishRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
    _: Subscription = Depends(verify_active_subscription),
    db: AsyncSession = Depends(get_db),
) -> PublishResponse:
    if payload.user_id != current_user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="userId does not match the authenticated user.",
        )

    slug_norm: str | None = None
    if dns_configured():
        if not payload.project_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="projectId is required when custom domain (Cloudflare) is configured.",
            )
        raw_slug = (payload.slug or "").strip().lower()
        if not raw_slug:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="slug is required when custom domain is configured.",
            )
        try:
            validate_slug(raw_slug)
        except ValueError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        slug_norm = raw_slug
        if await is_publish_slug_taken_by_other_project(db, slug_norm, payload.project_id):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Ce nom est déjà utilisé",
            )

    file_map: list[tuple[str, str]] = []
    project: SiteProject | None = None

    if payload.project_id:
        result = await db.execute(
            select(SiteProject).where(
                SiteProject.id == payload.project_id,
                SiteProject.workspace_id == workspace_id,
            )
        )
        project = result.scalars().first()
        if not project:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Site project not found.")
        index_path = Path(SITES_DIR) / payload.project_id / "index.html"
        if not index_path.is_file():
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="No generated index.html for this project. Generate the site first.",
            )
        html = index_path.read_text(encoding="utf-8")
        file_map = split_html_to_static_files(html)
    else:
        file_map = _normalize_paths(payload.files)

    if not file_map:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Nothing to publish. Provide projectId or files[].",
        )

    deployment: SiteDeployment | None = None
    if project:
        deployment = SiteDeployment(
            id=str(uuid.uuid4()),
            project_id=project.id,
            slug=slug_norm,
            status="pending",
        )
        db.add(deployment)
        await db.flush()
        project.publication_status = "publishing"
        await db.flush()

    site_url: str | None = None
    deploy_ok = False
    dns_applied = False
    actions_url = ""
    github_url = ""
    cloud_run_url: str | None = None

    try:
        try:
            logger.info(
                "[publish] start project_id=%s slug=%s",
                payload.project_id,
                slug_norm,
            )
            github_url, service_name, commit_sha = await asyncio.to_thread(
                publish_site_files, file_map, current_user.id
            )
            logger.info("[publish] GitHub push OK repo=%s service_name=%s", github_url, service_name)
        except GitHubPublishError as exc:
            step = f"{exc.step}: " if exc.step else ""
            logger.warning("Publish failed: %s%s", step, exc)
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                detail=f"{step}{exc}",
            ) from exc

        actions_url = github_url.rstrip("/") + "/actions"

        if project:
            project.github_repo_url = github_url
            project.cloud_run_service_name = service_name
        if deployment:
            deployment.github_repo_url = github_url
            deployment.cloud_run_service_name = service_name
            deployment.commit_sha = commit_sha
            deployment.status = "github_pushed"
        await db.flush()

        logger.info("[publish] polling Cloud Run until URL (max %ss)…", settings.CLOUD_RUN_POLL_MAX_SECONDS)

        def _poll_cloud_run() -> str | None:
            return wait_for_cloud_run_url(
                settings.GCP_PROJECT_ID.strip(),
                (settings.GCP_REGION or "us-central1").strip(),
                service_name,
                max_seconds=settings.CLOUD_RUN_POLL_MAX_SECONDS,
                interval_seconds=settings.CLOUD_RUN_POLL_INTERVAL_SECONDS,
            )

        cloud_run_url = await asyncio.to_thread(_poll_cloud_run)
        logger.info("[publish] Cloud Run URL=%s", cloud_run_url or "(none yet)")

        if project:
            project.cloud_run_url = cloud_run_url
        if deployment:
            deployment.cloud_run_url = cloud_run_url
            if cloud_run_url:
                deployment.status = "cloud_run_ready"

        if dns_configured():
            if not slug_norm:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    detail="slug is required when custom domain is configured.",
                )
            if not cloud_run_url:
                raise HTTPException(
                    status.HTTP_502_BAD_GATEWAY,
                    detail="Cloud Run URL not available in time. Open Actions and check the workflow.",
                )
            logger.info(
                "[publish] domain mapping + Cloudflare DNS for slug=%s (max mapping %ss)…",
                slug_norm,
                settings.GCP_DOMAIN_MAPPING_POLL_MAX_SECONDS,
            )
            try:
                site_url = await asyncio.to_thread(
                    ensure_mapped_domain_and_cloudflare_dns,
                    slug_norm,
                    service_name=service_name,
                )
            except (DnsError, DomainMappingError) as exc:
                raise HTTPException(
                    status.HTTP_502_BAD_GATEWAY,
                    detail=str(exc),
                ) from exc
            deploy_ok = bool(site_url)
            dns_applied = deploy_ok
            logger.info("[publish] done site_url=%s deploy_ok=%s", site_url, deploy_ok)
            if project:
                project.site_url = site_url
                project.publish_slug = slug_norm
            if deployment:
                deployment.site_url = site_url
                deployment.slug = slug_norm
                deployment.status = "success" if deploy_ok else "failed"
                if not deploy_ok:
                    deployment.error_message = "Domain mapping / DNS incomplet."
        else:
            site_url = cloud_run_url
            deploy_ok = bool(cloud_run_url)
            logger.info("[publish] done (no custom DNS) site_url=%s deploy_ok=%s", site_url, deploy_ok)
            if project:
                project.site_url = site_url
            if deployment:
                deployment.site_url = site_url
                deployment.status = "success" if deploy_ok else "failed"
                if not deploy_ok:
                    deployment.error_message = "Cloud Run URL not available within poll window."

        if project:
            project.publication_status = "live" if deploy_ok else "failed"

        await db.commit()

    except HTTPException as exc:
        if deployment:
            deployment.status = "failed"
            deployment.error_message = _http_detail_str(exc.detail)
        if project:
            project.publication_status = "failed"
        await db.commit()
        raise

    except Exception as exc:
        logger.exception("Unexpected publish error")
        if deployment:
            deployment.status = "failed"
            deployment.error_message = str(exc)[:4000]
        if project:
            project.publication_status = "failed"
        await db.commit()
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=f"Unexpected error while publishing: {exc}",
        ) from exc

    return PublishResponse(
        github=github_url,
        site_url=site_url,
        deploy_ok=deploy_ok,
        success=deploy_ok,
        actions_url=actions_url,
        cloud_run=cloud_run_url,
        dns_applied=dns_applied,
    )
