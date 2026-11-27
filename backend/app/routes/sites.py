"""
routes/sites.py
Site-builder endpoints: chat with Laurena, generate site, preview.
Protected by active subscription.
"""
import json
import logging
from uuid import UUID
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import (
    verify_active_subscription,
    check_and_increment_usage,
)
from app.db.session import get_db
from app.models.site_project import GeneratedSite, SiteDeployment, SiteProject, SitePrompt
from app.models.background_job import BackgroundJob
from app.models.subscription import Subscription
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.site import (
    ChatMessage,
    DeletePublishedSiteEnqueueResponse,
    GenerateSiteRequest,
    GenerateSiteResponse,
    DeploymentInfo,
    PublishedSiteItem,
    ProjectSummary,
    SiteChatRequest,
    SiteChatResponse,
    SitePromptItem,
    SiteStatusResponse,
)
from app.schemas.job import BackgroundJobResponse
from app.core.config import settings
from app.services.site_ai_service import (
    GeminiGenerationError,
    build_site_generation_brief_from_prompts,
    generate_chat_reply,
)
from app.services.job_service import create_job, get_job
from app.services.arq_enqueue import enqueue_delete_published_site_job, enqueue_generate_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sites", tags=["Site Builder"])


def _service_name_from_repo_url(repo_url: str | None) -> str | None:
    raw = (repo_url or "").strip()
    if not raw:
        return None
    try:
        path = urlparse(raw).path or ""
    except Exception:
        return None
    parts = [p for p in path.strip("/").split("/") if p]
    if len(parts) < 2:
        return None
    repo = parts[-1]
    if repo.endswith(".git"):
        repo = repo[:-4]
    return repo or None


# -- POST /sites/chat ---------------------------------------------------------

@router.post("/chat", response_model=SiteChatResponse, summary="Chat with Laurena about a site")
async def site_chat(
    payload: SiteChatRequest,
    current_user: User = Depends(get_current_user),
    subscription: Subscription = Depends(verify_active_subscription),
    db: AsyncSession = Depends(get_db),
) -> SiteChatResponse:
    # Get or create project
    project: SiteProject | None = None
    if payload.project_id:
        result = await db.execute(
            select(SiteProject)
            .options(selectinload(SiteProject.prompts))
            .where(
                SiteProject.id == payload.project_id,
                SiteProject.user_id == current_user.id,
            )
        )
        project = result.scalars().first()
        if not project:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Projeto nao encontrado.")

    if not project:
        project = SiteProject(user_id=current_user.id, name="Novo site")
        db.add(project)
        await db.flush()

    # Persist the latest user message
    last_user = payload.messages[-1]
    if last_user.role != "user":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ultima mensagem deve ser do user.")

    db.add(SitePrompt(project_id=project.id, role="user", content=last_user.content))

    # Build conversation for Replicate (chat)
    history = [{"role": m.role, "content": m.content} for m in payload.messages]

    await check_and_increment_usage(db, subscription.workspace_id, "text", subscription)

    try:
        reply = await generate_chat_reply(history, last_user.content)
    except GeminiGenerationError as exc:
        logger.warning("Site chat blocked or empty: %s", exc.reason)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=exc.user_message,
        ) from exc
    except Exception as exc:
        # SECURITY: ne pas exposer les détails internes au client
        logger.exception("Site chat AI error: %s", exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Serviço de IA temporariamente indisponível.")

    db.add(
        SitePrompt(
            project_id=project.id,
            role="assistant",
            content=reply,
            model_used=settings.REPLICATE_SITE_CHAT_MODEL,
        )
    )
    await db.flush()

    prompt_count = len(payload.messages) + 1
    await db.commit()

    return SiteChatResponse(
        project_id=project.id,
        reply=reply,
        message_count=prompt_count,
        job_id=None,
    )


# -- POST /sites/generate ----------------------------------------------------

@router.post(
    "/generate",
    response_model=GenerateSiteResponse,
    response_model_by_alias=True,
    summary="Enqueue site generation from the chat brief",
)
async def generate_site(
    payload: GenerateSiteRequest,
    current_user: User = Depends(get_current_user),
    subscription: Subscription = Depends(verify_active_subscription),
    db: AsyncSession = Depends(get_db),
) -> GenerateSiteResponse:
    result = await db.execute(
        select(SiteProject)
        .options(selectinload(SiteProject.prompts), selectinload(SiteProject.site))
        .where(
            SiteProject.id == payload.project_id,
            SiteProject.user_id == current_user.id,
        )
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Projeto nao encontrado.")

    plist = list(project.prompts)
    if not any(p.role == "user" for p in plist):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nenhuma descricao encontrada. Envie mensagens primeiro.")

    brief = build_site_generation_brief_from_prompts(plist)
    project.user_prompt = brief

    project.status = "generating"
    await db.flush()

    await check_and_increment_usage(db, subscription.workspace_id, "text", subscription)

    job = await create_job(
        db,
        job_type="generate_site",
        user_id=current_user.id,
        project_id=payload.project_id,
        input_payload=None,
    )
    await db.commit()

    await enqueue_generate_job(str(job.id))

    return GenerateSiteResponse(
        job_id=str(job.id),
        project_id=project.id,
        message="Geracao em fila em segundo plano.",
    )


# -- GET /sites/jobs/{job_id} (before /{project_id}) -------------------------

@router.get(
    "/jobs/{job_id}",
    response_model=BackgroundJobResponse,
    response_model_by_alias=True,
    summary="Poll generation job status",
)
async def get_site_job(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BackgroundJobResponse:
    row = await get_job(db, job_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job not found.")
    if row.job_type != "generate_site":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job not found.")
    return BackgroundJobResponse.from_model(row)


@router.get("/published-sites", response_model=list[PublishedSiteItem], summary="List published sites history")
async def list_published_sites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PublishedSiteItem]:
    result = await db.execute(
        select(SiteDeployment, SiteProject)
        .join(SiteProject, SiteProject.id == SiteDeployment.project_id)
        .where(SiteProject.user_id == current_user.id)
        .order_by(desc(SiteDeployment.created_at))
        .limit(100)
    )
    rows = result.all()

    out: list[PublishedSiteItem] = []
    seen_deployments: set[str] = set()
    for dep, proj in rows:
        # Always include pending/processing deployments so users can see in-progress publishes.
        # For completed deployments, require at least one URL or slug to be meaningful.
        is_active = dep.status in ("pending", "processing")
        has_info = any([dep.site_url, dep.github_repo_url, dep.cloud_run_url, dep.slug])
        if not is_active and not has_info:
            continue
        seen_deployments.add(dep.id)
        out.append(
            PublishedSiteItem(
                deployment_id=dep.id,
                project_id=proj.id,
                project_name=proj.name,
                status=dep.status,
                created_at=dep.created_at.isoformat(),
                slug=dep.slug,
                site_url=dep.site_url,
                github_repo_url=dep.github_repo_url,
                cloud_run_service_name=dep.cloud_run_service_name,
                cloud_run_url=dep.cloud_run_url,
                error_message=dep.error_message,
            )
        )

    # Legacy fallback: template publishes enqueued before deployment persistence was added.
    jobs_result = await db.execute(
        select(BackgroundJob)
        .where(BackgroundJob.job_type == "publish_site")
        .where(BackgroundJob.status == "success")
        .where(BackgroundJob.project_id.is_(None))
        .order_by(desc(BackgroundJob.created_at))
        .limit(100)
    )
    jobs = jobs_result.scalars().all()
    for job in jobs:
        if str(job.user_id) != current_user.id:
            continue
        input_payload = job.input_payload or {}

        result_payload = job.result or {}
        site_url = (result_payload.get("siteUrl") or "").strip() or None
        github_repo_url = (result_payload.get("github") or "").strip() or None
        cloud_run_url = (result_payload.get("cloudRun") or "").strip() or None
        cloud_run_service_name = (
            (result_payload.get("cloudRunServiceName") or "").strip()
            or _service_name_from_repo_url(github_repo_url)
        )
        slug = (input_payload.get("slug") or "").strip().lower() or None
        synthetic_id = f"job:{job.id}"
        if synthetic_id in seen_deployments:
            continue
        if not site_url and not github_repo_url and not cloud_run_url:
            continue

        out.append(
            PublishedSiteItem(
                deployment_id=synthetic_id,
                project_id="",
                project_name="Template",
                status="success",
                created_at=job.created_at.isoformat(),
                slug=slug,
                site_url=site_url,
                github_repo_url=github_repo_url,
                cloud_run_service_name=cloud_run_service_name,
                cloud_run_url=cloud_run_url,
                error_message=None,
            )
        )

    out.sort(key=lambda x: x.created_at, reverse=True)
    return out


@router.post(
    "/published-sites/{deployment_id}/delete",
    response_model=DeletePublishedSiteEnqueueResponse,
    response_model_by_alias=True,
    summary="Delete published site resources (GitHub, Cloud Run, Cloudflare)",
)
async def delete_published_site(
    deployment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeletePublishedSiteEnqueueResponse:
    if deployment_id.startswith("job:"):
        raw_job_id = deployment_id.split(":", 1)[1].strip()
        try:
            publish_job_id = UUID(raw_job_id)
        except ValueError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Identifiant de publication invalide.") from exc

        job_result = await db.execute(
            select(BackgroundJob).where(BackgroundJob.id == publish_job_id)
        )
        publish_job = job_result.scalars().first()
        if not publish_job:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Publication non trouvee.")
        if publish_job.user_id != current_user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Acces refuse.")
        if publish_job.job_type != "publish_site" or publish_job.status != "success":
            raise HTTPException(status.HTTP_409_CONFLICT, "La publication n'est pas dans un etat supprimable.")

        input_payload = publish_job.input_payload or {}
        result_payload = publish_job.result or {}

        repo_url = (result_payload.get("github") or "").strip() or None
        service_name = (result_payload.get("cloudRunServiceName") or "").strip() or _service_name_from_repo_url(repo_url)
        slug = (input_payload.get("slug") or "").strip().lower() or None

        delete_input = {
            "user_id": current_user.id,
            "project_id": None,
            "deployment_id": None,
            "slug": slug,
            "github_repo_url": repo_url,
            "cloud_run_service_name": service_name,
            "cloud_run_url": (result_payload.get("cloudRun") or "").strip() or None,
            "site_url": (result_payload.get("siteUrl") or "").strip() or None,
        }

        delete_job = await create_job(
            db,
            job_type="delete_published_site",
            user_id=current_user.id,
            project_id=None,
            input_payload=delete_input,
        )
        await db.commit()
        await enqueue_delete_published_site_job(str(delete_job.id))
        return DeletePublishedSiteEnqueueResponse(job_id=str(delete_job.id))

    result = await db.execute(
        select(SiteDeployment, SiteProject)
        .join(SiteProject, SiteProject.id == SiteDeployment.project_id)
        .where(SiteDeployment.id == deployment_id)
        .where(SiteProject.user_id == current_user.id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Publicacao nao encontrada.")

    deployment, project = row
    if deployment.status == "deleting":
        raise HTTPException(status.HTTP_409_CONFLICT, "Remocao ja em andamento para este site.")

    slug = (deployment.slug or project.publish_slug or "").strip().lower() or None

    input_payload = {
        "user_id": current_user.id,
        "project_id": project.id,
        "deployment_id": deployment.id,
        "slug": slug,
        "github_repo_url": deployment.github_repo_url,
        "cloud_run_service_name": deployment.cloud_run_service_name,
        "cloud_run_url": deployment.cloud_run_url,
        "site_url": deployment.site_url,
    }

    job = await create_job(
        db,
        job_type="delete_published_site",
        user_id=current_user.id,
        project_id=project.id,
        input_payload=input_payload,
    )

    deployment.status = "deleting"
    deployment.error_message = None
    project.publication_status = "deleting"
    await db.flush()
    await db.commit()

    await enqueue_delete_published_site_job(str(job.id))

    return DeletePublishedSiteEnqueueResponse(job_id=str(job.id))


@router.get(
    "/published-sites/jobs/{job_id}",
    response_model=BackgroundJobResponse,
    response_model_by_alias=True,
    summary="Poll published-site deletion job status",
)
async def get_published_site_delete_job(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BackgroundJobResponse:
    row = await get_job(db, job_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job not found.")
    if row.job_type != "delete_published_site":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job not found.")
    return BackgroundJobResponse.from_model(row)


# -- GET /sites/{project_id} -------------------------------------------------

@router.get("/{project_id}", response_model=SiteStatusResponse, summary="Get site project status")
async def get_site_status(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SiteStatusResponse:
    result = await db.execute(
        select(SiteProject)
        .options(selectinload(SiteProject.site), selectinload(SiteProject.prompts))
        .where(
            SiteProject.id == project_id,
            SiteProject.user_id == current_user.id,
        )
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Projeto nao encontrado.")

    site = project.site
    prompt_rows = [
        SitePromptItem(id=p.id, role=p.role, content=p.content)
        for p in sorted(project.prompts, key=lambda x: x.created_at)
    ]
    dep_result = await db.execute(
        select(SiteDeployment)
        .where(SiteDeployment.project_id == project_id)
        .order_by(desc(SiteDeployment.created_at))
        .limit(20)
    )
    deployments = dep_result.scalars().all()
    dep_infos = [
        DeploymentInfo(
            id=d.id,
            status=d.status,
            created_at=d.created_at.isoformat(),
            github_repo_url=d.github_repo_url,
            cloud_run_service_name=d.cloud_run_service_name,
            cloud_run_url=d.cloud_run_url,
            site_url=d.site_url,
            slug=d.slug,
            commit_sha=d.commit_sha,
            error_message=d.error_message,
        )
        for d in deployments
    ]

    return SiteStatusResponse(
        project_id=project.id,
        project_name=project.name,
        status=project.status,
        preview_url=site.preview_url if site else None,
        structure_json=site.structure_json if site else None,
        error_message=site.error_message if site else None,
        user_prompt=project.user_prompt,
        publish_slug=project.publish_slug,
        github_repo_url=project.github_repo_url,
        cloud_run_url=project.cloud_run_url,
        cloud_run_service_name=project.cloud_run_service_name,
        site_url=project.site_url,
        publication_status=project.publication_status,
        deployments=dep_infos,
        prompts=prompt_rows,
    )


# -- GET /sites/ (list projects) ---------------------------------------------

@router.get("/", response_model=list[ProjectSummary], summary="List site projects")
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectSummary]:
    result = await db.execute(
        select(SiteProject)
        .options(selectinload(SiteProject.site))
        .where(SiteProject.user_id == current_user.id)
        .order_by(SiteProject.created_at.desc())
        .limit(50)
    )
    projects = result.scalars().all()
    return [
        ProjectSummary(
            id=p.id,
            name=p.name,
            status=p.status,
            created_at=p.created_at.isoformat(),
            has_site=p.site is not None and p.site.status == "ready",
            publish_slug=p.publish_slug,
        )
        for p in projects
    ]
