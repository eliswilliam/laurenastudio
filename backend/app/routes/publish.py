"""
POST /api/publish — enqueue GitHub → Cloud Run → optional Cloudflare DNS (background job).
GET /api/publish/jobs/{job_id} — poll job status.
"""
from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_workspace_id, verify_active_subscription
from app.db.session import get_db
from app.models.site_project import SiteDeployment, SiteProject
from app.models.subscription import Subscription
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.job import BackgroundJobResponse, PublishEnqueueResponse
from app.schemas.publish import PublishRequest
from app.services.arq_enqueue import enqueue_publish_job
from app.services.dns_service import dns_configured, validate_slug
from app.services.job_service import create_job, get_job
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


@router.get(
    "/publish/jobs/{job_id}",
    response_model=BackgroundJobResponse,
    response_model_by_alias=True,
    summary="Poll publish job status",
)
async def get_publish_job(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BackgroundJobResponse:
    row = await get_job(db, job_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job not found.")
    if row.job_type != "publish_site":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job not found.")
    return BackgroundJobResponse.from_model(row)


@router.post(
    "/publish",
    response_model=PublishEnqueueResponse,
    response_model_by_alias=True,
    summary="Enqueue publish to GitHub / Cloud Run",
)
async def publish_site(
    payload: PublishRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
    _: Subscription = Depends(verify_active_subscription),
    db: AsyncSession = Depends(get_db),
) -> PublishEnqueueResponse:
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

    files_payload: list[dict[str, str]] = []
    if not payload.project_id:
        files_payload = [{"path": p, "content": c} for p, c in file_map]

    input_payload = {
        "workspace_id": workspace_id,
        "user_id": current_user.id,
        "project_id": payload.project_id,
        "slug": slug_norm,
        "deployment_id": deployment.id if deployment else None,
        "files": files_payload,
    }

    job = await create_job(
        db,
        job_type="publish_site",
        user_id=current_user.id,
        project_id=payload.project_id,
        input_payload=input_payload,
    )
    await db.commit()

    await enqueue_publish_job(str(job.id))

    return PublishEnqueueResponse(job_id=str(job.id))
