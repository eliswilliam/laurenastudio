"""
ARQ task: full publish pipeline (GitHub → Cloud Run → optional DNS).
"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from uuid import UUID

from sqlalchemy import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.site_project import SiteDeployment, SiteProject
from app.schemas.publish import PublishResponse
from app.services.cloud_run_lookup import wait_for_cloud_run_url
from app.services.cloud_run_domain_mapping import DomainMappingError, ensure_mapped_domain_and_cloudflare_dns
from app.services.dns_service import DnsError, dns_configured
from app.services.github_publish_service import GitHubPublishError, publish_site_files
from app.services.job_service import append_log, get_job, mark_failed, mark_running, mark_success
from app.services.site_generator import SITES_DIR
from app.services.site_static_bundle import split_html_to_static_files

logger = logging.getLogger(__name__)


async def arq_publish_site(ctx: dict, job_id: str) -> None:
    jid = UUID(job_id)
    async with AsyncSessionLocal() as db:
        job = await get_job(db, jid)
        if not job:
            logger.error("publish task: job not found %s", job_id)
            return

        payload = job.input_payload or {}
        workspace_id = payload.get("workspace_id") or ""
        user_id = payload.get("user_id") or job.user_id
        project_id = payload.get("project_id")
        slug_norm: str | None = payload.get("slug")
        deployment_id = payload.get("deployment_id")
        raw_files = payload.get("files") or []

        await mark_running(db, jid)
        await db.commit()

        await append_log(db, jid, "Iniciando publicação (GitHub → Cloud Run)…")
        await db.commit()

        file_map: list[tuple[str, str]] = []
        project: SiteProject | None = None
        deployment: SiteDeployment | None = None

        if project_id:
            result = await db.execute(
                select(SiteProject).where(
                    SiteProject.id == project_id,
                    SiteProject.workspace_id == workspace_id,
                )
            )
            project = result.scalars().first()
            if not project:
                await append_log(db, jid, "Erro: projeto não encontrado.")
                await mark_failed(db, jid, "Site project not found.")
                await db.commit()
                raise RuntimeError("Site project not found.")

            index_path = Path(SITES_DIR) / project_id / "index.html"
            if not index_path.is_file():
                await append_log(db, jid, "Erro: gere o site antes de publicar.")
                await mark_failed(db, jid, "No generated index.html for this project.")
                if project:
                    project.publication_status = "failed"
                await db.commit()
                raise RuntimeError("No index.html")

            html = index_path.read_text(encoding="utf-8")
            file_map = split_html_to_static_files(html)

            if deployment_id:
                dep_result = await db.execute(
                    select(SiteDeployment).where(SiteDeployment.id == deployment_id)
                )
                deployment = dep_result.scalars().first()
        else:
            norm: list[tuple[str, str]] = []
            for f in raw_files:
                if isinstance(f, dict):
                    p = (f.get("path") or "").strip().replace("\\", "/").lstrip("/")
                    c = f.get("content") or ""
                    if p and not p.startswith("..") and "/../" not in f"/{p}/":
                        norm.append((p, c))
            file_map = norm

        if not file_map:
            await append_log(db, jid, "Erro: nada para publicar.")
            await mark_failed(db, jid, "Nothing to publish.")
            await db.commit()
            raise RuntimeError("Nothing to publish")

        site_url: str | None = None
        deploy_ok = False
        dns_applied = False
        actions_url = ""
        github_url = ""
        cloud_run_url: str | None = None
        service_name = ""

        try:
            await append_log(db, jid, "A enviar ficheiros para o GitHub…")
            await db.commit()

            try:
                logger.info(
                    "[publish-task] start job_id=%s project_id=%s slug=%s",
                    job_id,
                    project_id,
                    slug_norm,
                )
                github_url, service_name, commit_sha = await asyncio.to_thread(
                    publish_site_files, file_map, user_id
                )
                logger.info("[publish-task] GitHub OK repo=%s service=%s", github_url, service_name)
            except GitHubPublishError as exc:
                step = f"{exc.step}: " if exc.step else ""
                msg = f"{step}{exc}"
                await append_log(db, jid, f"Falha no GitHub: {msg}")
                if deployment:
                    deployment.status = "failed"
                    deployment.error_message = msg[:4000]
                if project:
                    project.publication_status = "failed"
                await mark_failed(db, jid, msg)
                await db.commit()
                raise RuntimeError(msg) from exc

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

            await append_log(db, jid, "A aguardar URL do Cloud Run (pode demorar vários minutos)…")
            await db.commit()

            def _poll_cloud_run() -> str | None:
                return wait_for_cloud_run_url(
                    settings.GCP_PROJECT_ID.strip(),
                    (settings.GCP_REGION or "us-central1").strip(),
                    service_name,
                    max_seconds=settings.CLOUD_RUN_POLL_MAX_SECONDS,
                    interval_seconds=settings.CLOUD_RUN_POLL_INTERVAL_SECONDS,
                )

            cloud_run_url = await asyncio.to_thread(_poll_cloud_run)
            logger.info("[publish-task] Cloud Run URL=%s", cloud_run_url or "(none)")

            if project:
                project.cloud_run_url = cloud_run_url
            if deployment:
                deployment.cloud_run_url = cloud_run_url
                if cloud_run_url:
                    deployment.status = "cloud_run_ready"
            await db.flush()

            if dns_configured():
                if not slug_norm:
                    msg = "slug is required when custom domain is configured."
                    await append_log(db, jid, f"Erro: {msg}")
                    if deployment:
                        deployment.status = "failed"
                        deployment.error_message = msg
                    if project:
                        project.publication_status = "failed"
                    await mark_failed(db, jid, msg)
                    await db.commit()
                    raise RuntimeError(msg)
                if not cloud_run_url:
                    msg = "Cloud Run URL not available in time. Open Actions and check the workflow."
                    await append_log(db, jid, f"Erro: {msg}")
                    if deployment:
                        deployment.status = "failed"
                        deployment.error_message = msg
                    if project:
                        project.publication_status = "failed"
                    await mark_failed(db, jid, msg)
                    await db.commit()
                    raise RuntimeError(msg)

                await append_log(
                    db,
                    jid,
                    "A mapear domínio e configurar DNS (Cloudflare)…",
                )
                await db.commit()

                try:
                    site_url = await asyncio.to_thread(
                        ensure_mapped_domain_and_cloudflare_dns,
                        slug_norm,
                        service_name=service_name,
                    )
                except (DnsError, DomainMappingError) as exc:
                    msg = str(exc)
                    await append_log(db, jid, f"Erro DNS / domínio: {msg}")
                    if deployment:
                        deployment.status = "failed"
                        deployment.error_message = msg[:4000]
                    if project:
                        project.publication_status = "failed"
                    await mark_failed(db, jid, msg)
                    await db.commit()
                    raise RuntimeError(msg) from exc

                deploy_ok = bool(site_url)
                dns_applied = deploy_ok
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
                if project:
                    project.site_url = site_url
                if deployment:
                    deployment.site_url = site_url
                    deployment.status = "success" if deploy_ok else "failed"
                    if not deploy_ok:
                        deployment.error_message = "Cloud Run URL not available within poll window."

            if project:
                project.publication_status = "live" if deploy_ok else "failed"

            resp = PublishResponse(
                github=github_url,
                site_url=site_url,
                deploy_ok=deploy_ok,
                success=deploy_ok,
                actions_url=actions_url,
                cloud_run=cloud_run_url,
                dns_applied=dns_applied,
            )
            result_dict = resp.model_dump(by_alias=True)

            await append_log(db, jid, "Publicação concluída.")
            await mark_success(db, jid, result_dict)
            await db.commit()

        except Exception as exc:
            logger.exception("publish task error")
            jcur = await get_job(db, jid)
            if jcur and jcur.status == "failed":
                raise
            msg = str(exc)[:4000]
            if deployment:
                deployment.status = "failed"
                deployment.error_message = msg
            if project:
                project.publication_status = "failed"
            await mark_failed(db, jid, msg)
            await db.commit()
            raise
