"""
routes/sites.py
Site-builder endpoints: chat with Laurena, generate site, preview.
Protected by active subscription.
"""
import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import (
    get_workspace_id,
    verify_active_subscription,
    check_and_increment_usage,
)
from app.db.session import get_db
from app.models.site_project import GeneratedSite, SiteDeployment, SiteProject, SitePrompt
from app.models.subscription import Subscription
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.site import (
    ChatMessage,
    GenerateSiteRequest,
    GenerateSiteResponse,
    DeploymentInfo,
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
from app.services.arq_enqueue import enqueue_generate_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sites", tags=["Site Builder"])


# ── POST /sites/chat ─────────────────────────────────────────────────────────

@router.post("/chat", response_model=SiteChatResponse, summary="Chat with Laurena about a site")
async def site_chat(
    payload: SiteChatRequest,
    workspace_id: str = Depends(get_workspace_id),
    subscription: Subscription = Depends(verify_active_subscription),
    db: AsyncSession = Depends(get_db),
) -> SiteChatResponse:
    # Get or create project
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
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Projeto não encontrado.")

    if not project:
        project = SiteProject(workspace_id=workspace_id, name="Novo site")
        db.add(project)
        await db.flush()

    # Persist the latest user message
    last_user = payload.messages[-1]
    if last_user.role != "user":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Última mensagem deve ser do user.")

    db.add(SitePrompt(project_id=project.id, role="user", content=last_user.content))

    # Build conversation for Groq (chat)
    history = [{"role": m.role, "content": m.content} for m in payload.messages]

    await check_and_increment_usage(db, workspace_id, "text", subscription)

    try:
        reply = await generate_chat_reply(history, last_user.content)
    except GeminiGenerationError as exc:
        logger.warning("Site chat blocked or empty: %s", exc.reason)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=exc.user_message,
        ) from exc
    except Exception as exc:
        logger.exception("Site chat AI error: %s", exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Erro da IA: {exc}")

    db.add(
        SitePrompt(
            project_id=project.id,
            role="assistant",
            content=reply,
            model_used=settings.GROQ_SITE_CHAT_MODEL,
        )
    )
    await db.flush()

    prompt_count = len(payload.messages) + 1
    return SiteChatResponse(project_id=project.id, reply=reply, message_count=prompt_count)


# ── POST /sites/generate ────────────────────────────────────────────────────

@router.post(
    "/generate",
    response_model=GenerateSiteResponse,
    response_model_by_alias=True,
    summary="Enqueue site generation from the chat brief",
)
async def generate_site(
    payload: GenerateSiteRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
    subscription: Subscription = Depends(verify_active_subscription),
    db: AsyncSession = Depends(get_db),
) -> GenerateSiteResponse:
    result = await db.execute(
        select(SiteProject)
        .options(selectinload(SiteProject.prompts), selectinload(SiteProject.site))
        .where(
            SiteProject.id == payload.project_id,
            SiteProject.workspace_id == workspace_id,
        )
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Projeto não encontrado.")

    plist = list(project.prompts)
    if not any(p.role == "user" for p in plist):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nenhuma descrição encontrada. Envie mensagens primeiro.")

    brief = build_site_generation_brief_from_prompts(plist)
    project.user_prompt = brief

    project.status = "generating"
    await db.flush()

    await check_and_increment_usage(db, workspace_id, "text", subscription)

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
        message="Geração em fila em segundo plano.",
    )


# ── GET /sites/jobs/{job_id} (before /{project_id}) ─────────────────────────

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


# ── GET /sites/{project_id} ─────────────────────────────────────────────────

@router.get("/{project_id}", response_model=SiteStatusResponse, summary="Get site project status")
async def get_site_status(
    project_id: str,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> SiteStatusResponse:
    result = await db.execute(
        select(SiteProject)
        .options(selectinload(SiteProject.site), selectinload(SiteProject.prompts))
        .where(
            SiteProject.id == project_id,
            SiteProject.workspace_id == workspace_id,
        )
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Projeto não encontrado.")

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


# ── GET /sites/ (list projects) ─────────────────────────────────────────────

@router.get("/", response_model=list[ProjectSummary], summary="List site projects")
async def list_projects(
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectSummary]:
    result = await db.execute(
        select(SiteProject)
        .options(selectinload(SiteProject.site))
        .where(SiteProject.workspace_id == workspace_id)
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
