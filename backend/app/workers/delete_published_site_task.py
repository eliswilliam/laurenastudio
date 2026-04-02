"""
ARQ task: delete a previously published site resources (GitHub repo, Cloud Run service, Cloudflare DNS).
"""
from __future__ import annotations

import asyncio
import logging
from urllib.parse import quote, urlparse
from uuid import UUID

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.db.worker_db import WorkerSessionLocal
from app.models.site_project import SiteDeployment, SiteProject
from app.services.cloud_run_lookup import get_gcp_access_token
from app.services.dns_service import DnsError, delete_subdomain_records, dns_configured
from app.services.job_service import append_log, get_job, mark_failed, mark_running, mark_success

logger = logging.getLogger(__name__)

MAX_TASK_RUNTIME_S = 600


async def _handle_delete_timeout(job_id: UUID) -> None:
    async with WorkerSessionLocal() as db:
        await append_log(db, job_id, "Timeout: tarefa de remocao excedeu 600s.")
        await mark_failed(db, job_id, "timeout")
        await db.commit()


def _parse_github_repo(repo_url: str) -> tuple[str, str] | None:
    raw = (repo_url or "").strip()
    if not raw:
        return None
    if raw.startswith("git@github.com:"):
        path = raw.split("git@github.com:", 1)[1]
        parts = [p for p in path.strip("/").split("/") if p]
    else:
        p = urlparse(raw)
        if "github.com" not in (p.netloc or "").lower():
            return None
        parts = [seg for seg in p.path.strip("/").split("/") if seg]
    if len(parts) < 2:
        return None
    owner = parts[0]
    repo = parts[1]
    if repo.endswith(".git"):
        repo = repo[:-4]
    if not owner or not repo:
        return None
    return owner, repo


def _github_headers() -> dict[str, str]:
    token = (settings.GITHUB_DELETE_TOKEN or settings.GITHUB_TOKEN or "").strip()
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _delete_github_repo(repo_url: str) -> bool:
    token = (settings.GITHUB_DELETE_TOKEN or settings.GITHUB_TOKEN or "").strip()
    if not token:
        return False
    parsed = _parse_github_repo(repo_url)
    if not parsed:
        return False

    owner, repo = parsed
    url = f"https://api.github.com/repos/{owner}/{repo}"
    with httpx.Client(timeout=60.0) as client:
        r = client.delete(url, headers=_github_headers())

    if r.status_code in (204, 404):
        return True
    raise RuntimeError(f"GitHub delete repository failed ({r.status_code}): {r.text[:500]}")


def _delete_cloud_run_resources(service_name: str, slug: str | None) -> dict[str, bool]:
    project_id = settings.GCP_PROJECT_ID.strip()
    region = (settings.GCP_REGION or "us-central1").strip()
    if not project_id or not service_name:
        return {"cloudRunDeleted": False, "domainMappingDeleted": False}

    token = get_gcp_access_token()
    headers = {"Authorization": f"Bearer {token}"}

    domain_mapping_deleted = False
    if slug and settings.ROOT_DOMAIN.strip():
        fqdn = f"{slug.strip().lower()}.{settings.ROOT_DOMAIN.strip().lower().rstrip('.')}"
        dm_url = (
            f"https://{region}-run.googleapis.com/apis/domains.cloudrun.com/v1"
            f"/namespaces/{project_id}/domainmappings/{quote(fqdn, safe='')}"
        )
        with httpx.Client(timeout=90.0) as client:
            dm_res = client.delete(dm_url, headers=headers)
        if dm_res.status_code in (200, 202, 204, 404):
            domain_mapping_deleted = True
        else:
            raise RuntimeError(
                f"Cloud Run domain mapping delete failed ({dm_res.status_code}): {dm_res.text[:800]}"
            )

    svc_url = (
        f"https://run.googleapis.com/v2/projects/{project_id}"
        f"/locations/{region}/services/{service_name}"
    )
    with httpx.Client(timeout=120.0) as client:
        svc_res = client.delete(svc_url, headers=headers)

    if svc_res.status_code not in (200, 202, 204, 404):
        raise RuntimeError(f"Cloud Run delete service failed ({svc_res.status_code}): {svc_res.text[:800]}")

    return {"cloudRunDeleted": True, "domainMappingDeleted": domain_mapping_deleted}


def _target_matches_project_snapshot(
    project: SiteProject,
    *,
    service_name: str | None,
    slug: str | None,
    repo_url: str | None,
) -> bool:
    if service_name and (project.cloud_run_service_name or "").strip() == service_name.strip():
        return True
    if slug and (project.publish_slug or "").strip().lower() == slug.strip().lower():
        return True
    if repo_url and (project.github_repo_url or "").strip() == repo_url.strip():
        return True
    return False


async def _arq_delete_published_site_impl(job_id: str) -> None:
    jid = UUID(job_id)
    async with WorkerSessionLocal() as db:
        job = await get_job(db, jid)
        if not job:
            logger.error("delete task: job not found %s", job_id)
            return

        payload = job.input_payload or {}
        deployment_id = payload.get("deployment_id")
        project_id = payload.get("project_id")
        user_id = payload.get("user_id") or job.user_id
        repo_url = (payload.get("github_repo_url") or "").strip()
        service_name = (payload.get("cloud_run_service_name") or "").strip()
        slug = (payload.get("slug") or "").strip().lower() or None

        await mark_running(db, jid)
        await append_log(db, jid, "Iniciando remocao do site publicado...")
        await db.commit()

        deployment: SiteDeployment | None = None
        project: SiteProject | None = None

        if deployment_id:
            dep_result = await db.execute(select(SiteDeployment).where(SiteDeployment.id == deployment_id))
            deployment = dep_result.scalars().first()

        if project_id:
            proj_result = await db.execute(
                select(SiteProject).where(
                    SiteProject.id == project_id,
                    SiteProject.user_id == str(user_id),
                )
            )
            project = proj_result.scalars().first()

        if deployment and not repo_url:
            repo_url = (deployment.github_repo_url or "").strip()
        if deployment and not service_name:
            service_name = (deployment.cloud_run_service_name or "").strip()
        if deployment and not slug:
            slug = ((deployment.slug or "").strip().lower() or None)

        report: dict[str, object] = {
            "githubDeleted": False,
            "cloudRunDeleted": False,
            "domainMappingDeleted": False,
            "dnsDeleted": False,
        }
        warnings: list[str] = []

        try:
            if repo_url:
                await append_log(db, jid, "Removendo repositorio no GitHub...")
                await db.commit()
                try:
                    report["githubDeleted"] = await asyncio.to_thread(_delete_github_repo, repo_url)
                except Exception as exc:
                    gh_msg = str(exc)
                    report["githubDeleted"] = False
                    report["githubDeleteError"] = gh_msg
                    warnings.append("GitHub repository was not deleted. Please verify token permissions (delete_repo/admin).")
                    await append_log(db, jid, f"Aviso GitHub: {gh_msg}")
                    await db.commit()
            else:
                await append_log(db, jid, "Repositorio GitHub ausente; etapa ignorada.")
                await db.commit()

            if service_name:
                await append_log(db, jid, "Removendo recursos do Cloud Run...")
                await db.commit()
                cloud_report = await asyncio.to_thread(_delete_cloud_run_resources, service_name, slug)
                report.update(cloud_report)
            else:
                await append_log(db, jid, "Servico Cloud Run ausente; etapa ignorada.")
                await db.commit()

            if slug and dns_configured():
                await append_log(db, jid, "Removendo DNS do subdominio no Cloudflare...")
                await db.commit()
                await asyncio.to_thread(delete_subdomain_records, slug)
                report["dnsDeleted"] = True
            elif slug:
                await append_log(db, jid, "Cloudflare nao configurado; etapa DNS ignorada.")
                await db.commit()
            else:
                await append_log(db, jid, "Slug ausente; etapa DNS ignorada.")
                await db.commit()

            if deployment:
                deployment.status = "deleted"
                deployment.error_message = " | ".join(warnings)[:4000] if warnings else None

            if project and _target_matches_project_snapshot(
                project,
                service_name=service_name,
                slug=slug,
                repo_url=repo_url,
            ):
                project.publication_status = "deleted"
                project.publish_slug = None
                project.site_url = None
                project.cloud_run_url = None
                project.cloud_run_service_name = None
                project.github_repo_url = None

            if warnings:
                report["warnings"] = warnings

            await append_log(db, jid, "Remocao concluida com sucesso." if not warnings else "Remocao concluida com avisos.")
            await mark_success(db, jid, report)
            await db.commit()

        except (DnsError, Exception) as exc:
            msg = str(exc)[:4000]
            if deployment:
                deployment.status = "delete_failed"
                deployment.error_message = msg
            if project and _target_matches_project_snapshot(
                project,
                service_name=service_name,
                slug=slug,
                repo_url=repo_url,
            ):
                project.publication_status = "failed"
            await append_log(db, jid, f"Falha na remocao: {msg}")
            await mark_failed(db, jid, msg)
            await db.commit()
            raise


async def arq_delete_published_site(ctx: dict, job_id: str) -> None:
    jid = UUID(job_id)
    try:
        await asyncio.wait_for(_arq_delete_published_site_impl(job_id), timeout=MAX_TASK_RUNTIME_S)
    except asyncio.TimeoutError:
        logger.warning("delete published site task exceeded %ss: %s", MAX_TASK_RUNTIME_S, job_id)
        await _handle_delete_timeout(jid)
