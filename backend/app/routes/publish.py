"""
POST /api/publish — enqueue GitHub → Cloud Run → optional Cloudflare DNS (background job).
GET /api/publish/jobs/{job_id} — poll job status.
"""
from __future__ import annotations

import json
import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import (
    check_and_increment_usage,
    verify_active_subscription,
)
from app.db.session import get_db
from app.models.site_project import SiteDeployment, SiteProject
from app.models.subscription import Subscription
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.job import BackgroundJobResponse, PublishEnqueueResponse
from app.schemas.publish import PublishRequest, SaveTemplateRequest, SaveTemplateResponse
from app.services.arq_enqueue import enqueue_publish_job
from app.services.dns_service import dns_configured, validate_slug
from app.services.job_service import create_job, get_job
from app.services.site_generator import SITES_DIR
from app.services.site_publish_queries import is_publish_slug_taken
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


def _expand_single_index_html(file_map: list[tuple[str, str]]) -> list[tuple[str, str]]:
    if len(file_map) != 1:
        return file_map
    path, content = file_map[0]
    if path.strip().lower() not in {"index.html", "index.htm"}:
        return file_map
    return split_html_to_static_files(content)


def _save_project_files(project_id: str, file_map: list[tuple[str, str]]) -> None:
    """Persist current publish payload so project-based deploys use the latest customized template."""
    project_dir = Path(SITES_DIR) / project_id
    if project_dir.exists():
        shutil.rmtree(project_dir, ignore_errors=True)
    project_dir.mkdir(parents=True, exist_ok=True)

    for rel_path, content in file_map:
        target = project_dir / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")


@router.post(
    "/publish/save",
    response_model=SaveTemplateResponse,
    response_model_by_alias=True,
    summary="Save template editor state without publishing",
)
async def save_template_state(
    payload: SaveTemplateRequest,
    current_user: User = Depends(get_current_user),
    _subscription: Subscription = Depends(verify_active_subscription),
    db: AsyncSession = Depends(get_db),
) -> SaveTemplateResponse:
    if payload.user_id != current_user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="userId does not match the authenticated user.",
        )

    slug_norm: str | None = None
    raw_slug = (payload.slug or "").strip().lower()
    if raw_slug:
        try:
            validate_slug(raw_slug)
        except ValueError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        slug_norm = raw_slug
        if await is_publish_slug_taken(db, slug_norm, exclude_project_id=payload.project_id):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Ce nom est déjà utilisé",
            )

    file_map = _expand_single_index_html(_normalize_paths(payload.files))
    if not file_map:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Nothing to save. Provide files[].",
        )

    project: SiteProject | None = None
    if payload.project_id:
        result = await db.execute(
            select(SiteProject).where(
                SiteProject.id == payload.project_id,
                SiteProject.user_id == current_user.id,
            )
        )
        project = result.scalars().first()
        if not project:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Site project not found.")

    if not project:
        inferred_name = f"Template {slug_norm}" if slug_norm else "Template draft"
        project = SiteProject(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            name=inferred_name,
            status="ready",
            publish_slug=slug_norm,
        )
        db.add(project)
        await db.flush()
    elif slug_norm:
        project.publish_slug = slug_norm

    _save_project_files(project.id, file_map)
    if project.status in {"draft", "error"}:
        project.status = "ready"

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        msg = str(getattr(exc, "orig", exc)).lower()
        if "publish_slug" in msg:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Ce nom est déjà utilisé",
            ) from exc
        raise

    return SaveTemplateResponse(project_id=project.id)


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
    subscription: Subscription = Depends(verify_active_subscription),
    db: AsyncSession = Depends(get_db),
) -> PublishEnqueueResponse:
    if payload.user_id != current_user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="userId does not match the authenticated user.",
        )

    slug_norm: str | None = None
    if dns_configured():
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
        if await is_publish_slug_taken(db, slug_norm, exclude_project_id=payload.project_id):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Ce nom est déjà utilisé",
            )

    normalized_payload_files = _expand_single_index_html(_normalize_paths(payload.files))
    has_payload_files = bool(normalized_payload_files)

    file_map: list[tuple[str, str]] = []
    project: SiteProject | None = None
    from_files_payload = False

    if payload.project_id:
        result = await db.execute(
            select(SiteProject).where(
                SiteProject.id == payload.project_id,
                SiteProject.user_id == current_user.id,
            )
        )
        project = result.scalars().first()
        if not project:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Site project not found.")
        if has_payload_files:
            # Template flow: publish the current editor state and keep it as latest project files.
            from_files_payload = True
            file_map = normalized_payload_files
            _save_project_files(project.id, file_map)
        else:
            index_path = Path(SITES_DIR) / payload.project_id / "index.html"
            if not index_path.is_file():
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    detail="No generated index.html for this project. Generate the site first.",
                )
            html = index_path.read_text(encoding="utf-8")
            file_map = split_html_to_static_files(html)
    else:
        from_files_payload = True
        file_map = normalized_payload_files

    if not file_map:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Nothing to publish. Provide projectId or files[].",
        )

    await check_and_increment_usage(
        db,
        subscription.workspace_id,
        "site_publish",
        subscription,
    )

    if not project and from_files_payload:
        inferred_name = f"Template {slug_norm}" if slug_norm else "Template published site"
        project = SiteProject(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            name=inferred_name,
            publish_slug=slug_norm,
            status="ready",
        )
        db.add(project)
        await db.flush()
        _save_project_files(project.id, file_map)

    if project and slug_norm:
        project.publish_slug = slug_norm

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
        project.last_publish_enqueue_at = datetime.now(timezone.utc)
        await db.flush()

    files_payload: list[dict[str, str]] = []
    if from_files_payload:
        files_payload = [{"path": p, "content": c} for p, c in file_map]

    input_payload = {
        "user_id": current_user.id,
        "project_id": project.id if project else payload.project_id,
        "slug": slug_norm,
        "deployment_id": deployment.id if deployment else None,
        "files": files_payload,
    }

    job = await create_job(
        db,
        job_type="publish_site",
        user_id=current_user.id,
        project_id=project.id if project else payload.project_id,
        input_payload=input_payload,
    )
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        msg = str(getattr(exc, "orig", exc)).lower()
        if "publish_slug" in msg:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Ce nom est déjà utilisé",
            ) from exc
        raise

    await enqueue_publish_job(str(job.id))

    return PublishEnqueueResponse(
        job_id=str(job.id),
        project_id=project.id if project else payload.project_id,
    )
