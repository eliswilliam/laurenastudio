"""
Service-to-service endpoints for the Laurena Builder subdomain.

Auth: Authorization: Bearer <OAUTH_TOKEN_SECRET>
Ces routes ne sont JAMAIS appelées par un navigateur — uniquement par le serveur Next.js.
"""
from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import get_db
from app.models.membership import Membership
from app.models.site_project import SiteDeployment, SiteProject
from app.models.subscription import Subscription
from app.schemas.job import BackgroundJobResponse, PublishEnqueueResponse
from app.services import auth_service
from app.services.arq_enqueue import enqueue_publish_job
from app.services.dns_service import dns_configured, validate_slug
from app.services.job_service import create_job, get_job
from app.services.site_publish_queries import is_publish_slug_taken
from app.routes.publish import _normalize_paths, _expand_single_index_html, _save_project_files

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/builder", tags=["Builder (service-to-service)"])


# ── Auth ──────────────────────────────────────────────────────────────────────

def _require_service_token(request: Request) -> None:
    """Comparaison en temps constant du secret partagé OAUTH_TOKEN_SECRET."""
    auth_header = request.headers.get("Authorization", "")
    expected = f"Bearer {settings.OAUTH_TOKEN_SECRET}"
    if not secrets.compare_digest(auth_header.encode(), expected.encode()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing service token.",
        )


# ── Schemas ───────────────────────────────────────────────────────────────────

class BuilderPublishFile(BaseModel):
    path: str
    content: str


class BuilderPublishRequest(BaseModel):
    user_id: str = Field(alias="userId")
    files: list[BuilderPublishFile] = Field(default_factory=list)
    project_id: str | None = Field(default=None, alias="projectId")
    slug: str | None = None

    model_config = {"populate_by_name": True}


# ── POST /api/v1/builder/publish ──────────────────────────────────────────────

@router.post(
    "/publish",
    response_model=PublishEnqueueResponse,
    response_model_by_alias=True,
    summary="Enqueue publish depuis le builder (service-to-service)",
)
async def builder_publish(
    request: Request,
    payload: BuilderPublishRequest,
    db: AsyncSession = Depends(get_db),
) -> PublishEnqueueResponse:
    _require_service_token(request)

    # ── 1. Charger l'utilisateur ──────────────────────────────────────────
    try:
        user = await auth_service.get_user_by_id(db, payload.user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable.")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte désactivé.")

    # ── 2. Vérifier l'abonnement actif ────────────────────────────────────
    membership_result = await db.execute(
        select(Membership)
        .where(Membership.user_id == user.id)
        .order_by(Membership.created_at.asc())
        .limit(1)
    )
    membership = membership_result.scalars().first()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Aucun abonnement trouvé.",
        )

    sub_result = await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .where(Subscription.workspace_id == membership.workspace_id)
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )
    subscription = sub_result.scalars().first()
    if not subscription or subscription.status not in ("active", "trialing", "past_due"):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Abonnement actif requis pour publier.",
        )

    # ── 3. Gérer le slug ──────────────────────────────────────────────────
    slug_norm: str | None = None
    if dns_configured():
        raw_slug = (payload.slug or "").strip().lower()
        if not raw_slug:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un slug est requis quand le domaine personnalisé est configuré.",
            )
        try:
            validate_slug(raw_slug)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        slug_norm = raw_slug
        if await is_publish_slug_taken(db, slug_norm, exclude_project_id=payload.project_id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ce nom est déjà utilisé.")
    elif payload.slug:
        slug_norm = payload.slug.strip().lower() or None

    # ── 4. Normaliser les fichiers ────────────────────────────────────────
    # _normalize_paths accède à f.path et f.content — BuilderPublishFile les expose bien
    file_map = _expand_single_index_html(_normalize_paths(payload.files))
    if not file_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun fichier à publier.",
        )

    # ── 5. Créer ou retrouver le projet ───────────────────────────────────
    project: SiteProject | None = None
    if payload.project_id:
        result = await db.execute(
            select(SiteProject).where(
                SiteProject.id == payload.project_id,
                SiteProject.user_id == user.id,
            )
        )
        project = result.scalars().first()

    if not project:
        project = SiteProject(
            id=str(uuid.uuid4()),
            user_id=user.id,
            name=f"Builder — {slug_norm or uuid.uuid4().hex[:8]}",
            publish_slug=slug_norm,
            status="ready",
        )
        db.add(project)
        await db.flush()

    if slug_norm:
        project.publish_slug = slug_norm

    _save_project_files(project.id, file_map)

    # ── 6. Créer l'entrée de déploiement ──────────────────────────────────
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

    # ── 7. Enqueue le job ─────────────────────────────────────────────────
    files_payload = [{"path": p, "content": c} for p, c in file_map]
    job = await create_job(
        db,
        job_type="publish_site",
        user_id=user.id,
        project_id=project.id,
        input_payload={
            "user_id": user.id,
            "project_id": project.id,
            "slug": slug_norm,
            "deployment_id": deployment.id,
            "files": files_payload,
        },
    )
    await db.commit()
    await enqueue_publish_job(str(job.id))

    logger.info(
        "Builder publish enqueued: user_id=%s project_id=%s job_id=%s",
        user.id, project.id, job.id,
    )
    return PublishEnqueueResponse(job_id=str(job.id), project_id=project.id)


# ── GET /api/v1/builder/publish/jobs/{job_id} ─────────────────────────────────

# ── GET /api/v1/builder/subscription/{user_id} ───────────────────────────────

class SubscriptionStatusResponse(BaseModel):
    plan_active: bool
    plan_name: str
    subscription_id: str


@router.get(
    "/subscription/{user_id}",
    response_model=SubscriptionStatusResponse,
    summary="Vérifie l'abonnement actif d'un utilisateur (service-to-service)",
)
async def builder_check_subscription(
    user_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SubscriptionStatusResponse:
    _require_service_token(request)

    membership_result = await db.execute(
        select(Membership)
        .where(Membership.user_id == user_id)
        .order_by(Membership.created_at.asc())
        .limit(1)
    )
    membership = membership_result.scalars().first()
    if not membership:
        return SubscriptionStatusResponse(plan_active=False, plan_name="", subscription_id="")

    sub_result = await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .where(Subscription.workspace_id == membership.workspace_id)
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )
    subscription = sub_result.scalars().first()
    if not subscription:
        return SubscriptionStatusResponse(plan_active=False, plan_name="", subscription_id="")

    return SubscriptionStatusResponse(
        plan_active=subscription.status in ("active", "trialing", "past_due"),
        plan_name=subscription.plan.name if subscription.plan else "",
        subscription_id=subscription.id,
    )


# ── GET /api/v1/builder/publish/jobs/{job_id} ─────────────────────────────────

@router.get(
    "/publish/jobs/{job_id}",
    response_model=BackgroundJobResponse,
    response_model_by_alias=True,
    summary="Statut d'un job de publication (service-to-service)",
)
async def builder_poll_job(
    job_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> BackgroundJobResponse:
    _require_service_token(request)

    # SECURITY: ownership validation is mandatory, not optional. Treat a missing
    # X-Laurena-User-Id header the same as a mismatch: any client holding the
    # service token must declare the user on whose behalf it is calling, or
    # the builder front-end could be tricked into polling jobs that belong to
    # another tenant just by omitting the header.
    requesting_user_id = request.headers.get("X-Laurena-User-Id", "").strip()
    if not requesting_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Laurena-User-Id header is required.",
        )

    row = await get_job(db, job_id)
    if not row or row.job_type != "publish_site":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job introuvable.")

    if row.user_id != requesting_user_id:
        logger.warning(
            "IDOR attempt: user_id=%s tried to access job_id=%s owned by user_id=%s",
            requesting_user_id, job_id, row.user_id,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job introuvable.")

    return BackgroundJobResponse.from_model(row)
