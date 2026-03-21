"""
routes/sites.py
Site-builder endpoints: chat with Laurena, generate site, preview, download.
Protected by active subscription.
"""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
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
from app.schemas.site import (
    ChatMessage,
    GenerateSiteRequest,
    GenerateSiteResponse,
    DeploymentInfo,
    ProjectSummary,
    SiteChatRequest,
    SiteChatResponse,
    SiteStatusResponse,
)
from app.core.config import settings
from app.services.site_ai_service import generate_chat_reply, generate_site_structure
from app.services.site_generator import create_zip, generate_html, save_site

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

    # Build conversation for Gemini
    history = [{"role": m.role, "content": m.content} for m in payload.messages]

    await check_and_increment_usage(db, workspace_id, "text", subscription)

    try:
        reply = await generate_chat_reply(history, last_user.content)
    except Exception as exc:
        logger.exception("Site chat AI error: %s", exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Erro da IA: {exc}")

    db.add(SitePrompt(project_id=project.id, role="assistant", content=reply, model_used=settings.GEMINI_TEXT_MODEL))
    await db.flush()

    prompt_count = len(payload.messages) + 1
    return SiteChatResponse(project_id=project.id, reply=reply, message_count=prompt_count)


# ── POST /sites/generate ────────────────────────────────────────────────────

@router.post("/generate", response_model=GenerateSiteResponse, summary="Generate a site from the chat brief")
async def generate_site(
    payload: GenerateSiteRequest,
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

    user_messages = [p.content for p in project.prompts if p.role == "user"]
    if not user_messages:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nenhuma descrição encontrada. Envie mensagens primeiro.")

    brief = "\n\n".join(user_messages)
    project.user_prompt = brief

    project.status = "generating"
    await db.flush()

    await check_and_increment_usage(db, workspace_id, "text", subscription)

    try:
        structure = await generate_site_structure(brief)
        html = generate_html(structure)
        html_path, preview_url = save_site(project.id, html, structure)
    except Exception as exc:
        logger.exception("Site generation failed: %s", exc)
        project.status = "error"
        if project.site:
            project.site.status = "error"
            project.site.error_message = str(exc)
        else:
            db.add(GeneratedSite(
                project_id=project.id,
                status="error",
                error_message=str(exc),
            ))
        await db.flush()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Falha na geração: {exc}")

    if project.site:
        project.site.structure_json = json.dumps(structure, ensure_ascii=False)
        project.site.html_path = html_path
        project.site.preview_url = preview_url
        project.site.status = "ready"
        project.site.error_message = None
    else:
        db.add(GeneratedSite(
            project_id=project.id,
            structure_json=json.dumps(structure, ensure_ascii=False),
            html_path=html_path,
            preview_url=preview_url,
            status="ready",
        ))

    project.status = "ready"
    project.name = structure.get("site_name", project.name)
    await db.flush()

    return GenerateSiteResponse(
        project_id=project.id,
        status="ready",
        preview_url=preview_url,
        download_url=f"/api/v1/sites/{project.id}/download",
        message="Site gerado com sucesso!",
    )


# ── GET /sites/{project_id} ─────────────────────────────────────────────────

@router.get("/{project_id}", response_model=SiteStatusResponse, summary="Get site project status")
async def get_site_status(
    project_id: str,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> SiteStatusResponse:
    result = await db.execute(
        select(SiteProject)
        .options(selectinload(SiteProject.site))
        .where(
            SiteProject.id == project_id,
            SiteProject.workspace_id == workspace_id,
        )
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Projeto não encontrado.")

    site = project.site
    download_url = f"/api/v1/sites/{project_id}/download" if site and site.status == "ready" else None

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
        download_url=download_url,
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
    )


# ── GET /sites/{project_id}/download ────────────────────────────────────────

@router.get("/{project_id}/download", summary="Download site as ZIP")
async def download_site(
    project_id: str,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SiteProject)
        .options(selectinload(SiteProject.site))
        .where(
            SiteProject.id == project_id,
            SiteProject.workspace_id == workspace_id,
        )
    )
    project = result.scalars().first()
    if not project or not project.site or project.site.status != "ready":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Site não disponível para download.")

    zip_bytes = create_zip(project_id)
    if not zip_bytes:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ficheiros do site não encontrados.")

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{project.name or "site"}.zip"'},
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
        )
        for p in projects
    ]
