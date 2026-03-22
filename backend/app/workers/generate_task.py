"""
ARQ task: run site generation (Gemini structure + Jinja2 HTML) for a background job.
"""
from __future__ import annotations

import asyncio
import json
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.worker_db import WorkerSessionLocal
from app.models.site_project import GeneratedSite, SiteProject
from app.services.job_service import append_log, get_job, mark_failed, mark_running, mark_success
from app.services.site_ai_service import generate_site_structure
from app.services.site_generator import generate_html, save_site

logger = logging.getLogger(__name__)

MAX_TASK_RUNTIME_S = 600


async def _handle_generate_timeout(job_id: UUID) -> None:
    async with WorkerSessionLocal() as db:
        await append_log(db, job_id, "Timeout: tarefa excedeu 600s.")
        await mark_failed(db, job_id, "timeout")
        await db.commit()


async def _arq_generate_site_impl(job_id: str) -> None:
    jid = UUID(job_id)
    async with WorkerSessionLocal() as db:
        job = await get_job(db, jid)
        if not job:
            logger.error("generate task: job not found %s", job_id)
            return

        await mark_running(db, jid)
        await db.commit()

        await append_log(db, jid, "Iniciando geração do site…")
        await db.commit()

        result = await db.execute(
            select(SiteProject)
            .options(selectinload(SiteProject.prompts), selectinload(SiteProject.site))
            .where(SiteProject.id == job.project_id)
        )
        project = result.scalars().first()
        if not project:
            await append_log(db, jid, "Erro: projeto não encontrado.")
            await mark_failed(db, jid, "Projeto não encontrado.")
            await db.commit()
            raise RuntimeError("Projeto não encontrado.")

        user_messages = [p.content for p in project.prompts if p.role == "user"]
        if not user_messages:
            await append_log(db, jid, "Erro: nenhuma mensagem do utilizador no briefing.")
            project.status = "error"
            await mark_failed(db, jid, "Nenhuma descrição encontrada. Envie mensagens primeiro.")
            await db.commit()
            raise RuntimeError("Nenhuma descrição encontrada.")

        brief = "\n\n".join(user_messages)
        project.user_prompt = brief
        project.status = "generating"
        await db.flush()
        await db.commit()

        await append_log(db, jid, "A gerar estrutura do site com IA (Gemini)…")
        await db.commit()

        try:
            structure = await generate_site_structure(brief)
        except Exception as exc:
            logger.exception("Gemini structure failed")
            await append_log(db, jid, f"Falha na IA: {exc}")
            project.status = "error"
            if project.site:
                project.site.status = "error"
                project.site.error_message = str(exc)
            else:
                db.add(
                    GeneratedSite(
                        project_id=project.id,
                        status="error",
                        error_message=str(exc),
                    )
                )
            await mark_failed(db, jid, str(exc))
            await db.commit()
            raise

        await append_log(db, jid, "A compilar HTML com Jinja2…")
        await db.commit()

        try:
            html = generate_html(structure)
            html_path, preview_url = save_site(project.id, html, structure)
        except Exception as exc:
            logger.exception("HTML / save failed")
            await append_log(db, jid, f"Falha ao guardar o site: {exc}")
            project.status = "error"
            if project.site:
                project.site.status = "error"
                project.site.error_message = str(exc)
            else:
                db.add(
                    GeneratedSite(
                        project_id=project.id,
                        status="error",
                        error_message=str(exc),
                    )
                )
            await mark_failed(db, jid, str(exc))
            await db.commit()
            raise

        await append_log(db, jid, "A guardar ficheiros e atualizar o projeto…")
        await db.commit()

        if project.site:
            project.site.structure_json = json.dumps(structure, ensure_ascii=False)
            project.site.html_path = html_path
            project.site.preview_url = preview_url
            project.site.status = "ready"
            project.site.error_message = None
        else:
            db.add(
                GeneratedSite(
                    project_id=project.id,
                    structure_json=json.dumps(structure, ensure_ascii=False),
                    html_path=html_path,
                    preview_url=preview_url,
                    status="ready",
                )
            )

        project.status = "ready"
        project.name = structure.get("site_name", project.name)
        await db.flush()

        out = {
            "projectId": project.id,
            "status": "ready",
            "previewUrl": preview_url,
            "downloadUrl": f"/api/v1/sites/{project.id}/download",
            "message": "Site gerado com sucesso!",
        }
        await append_log(db, jid, "Geração concluída com sucesso.")
        await mark_success(db, jid, out)
        await db.commit()


async def arq_generate_site(ctx: dict, job_id: str) -> None:
    jid = UUID(job_id)
    try:
        await asyncio.wait_for(_arq_generate_site_impl(job_id), timeout=MAX_TASK_RUNTIME_S)
    except asyncio.TimeoutError:
        logger.warning("generate task exceeded %ss: %s", MAX_TASK_RUNTIME_S, job_id)
        await _handle_generate_timeout(jid)
