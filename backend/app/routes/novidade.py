from __future__ import annotations

import hashlib
import json
import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import check_and_increment_usage, verify_active_subscription
from app.db.session import AsyncSessionLocal, get_db
from app.models.media import Media
from app.models.site_project import GeneratedSite, SiteGitSnapshot, SiteProject, SitePrompt
from app.models.subscription import Subscription
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.novidade import DbSaveRequest, DbSaveResponse, GenerateCodeRequest, SnapshotItem
from app.services.novidade_ai_service import GeminiStreamError, stream_gemini_code
from app.services.pexels_service import fetch_pexels_urls_for_prompt
from app.services.site_generator import SITES_DIR

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Novidade Builder"])


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _extract_project_title(messages: list[dict[str, Any]]) -> str | None:
    for msg in messages:
        if msg.get("role") != "assistant":
            continue
        content = str(msg.get("content") or "")
        marker = '<laurenaArtifact'
        idx = content.find(marker)
        if idx == -1:
            continue
        title_idx = content.find('title="', idx)
        if title_idx == -1:
            continue
        start = title_idx + len('title="')
        end = content.find('"', start)
        if end == -1:
            continue
        title = content[start:end].strip()
        if title:
            return title[:255]
    return None


def _normalize_files(files: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for raw_path, raw_content in files.items():
        path = (raw_path or "").strip().replace("\\", "/").lstrip("/")
        if not path or path.startswith("..") or "/../" in f"/{path}/":
            continue
        out[path] = str(raw_content or "")
    return out


def _save_project_files(project_id: str, files: dict[str, str]) -> str | None:
    if not files:
        return None
    project_dir = Path(SITES_DIR) / project_id
    if project_dir.exists():
        shutil.rmtree(project_dir, ignore_errors=True)
    project_dir.mkdir(parents=True, exist_ok=True)

    for rel_path, content in files.items():
        target = project_dir / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    index_exists = (project_dir / "index.html").is_file()
    if index_exists:
        return f"/uploads/sites/{project_id}/index.html"
    return None


def _snapshot_hash(files: dict[str, str]) -> str:
    canonical = json.dumps(files, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def _persist_chat_and_snapshot(
    *,
    project_id: str,
    user_id: str,
    messages: list[dict[str, Any]],
    files: dict[str, str],
) -> None:
    normalized_files = _normalize_files(files)

    async with AsyncSessionLocal() as db:
        try:
            project_result = await db.execute(
                select(SiteProject).where(
                    SiteProject.id == project_id,
                    SiteProject.user_id == user_id,
                )
            )
            project = project_result.scalars().first()
            if not project:
                logger.warning("novidade db-save skipped: project not found id=%s user=%s", project_id, user_id)
                return

            await db.execute(delete(SitePrompt).where(SitePrompt.project_id == project_id))

            sorted_messages = sorted(
                messages,
                key=lambda m: str(m.get("createdAt") or m.get("created_at") or ""),
            )
            for msg in sorted_messages:
                role = str(msg.get("role") or "")
                if role not in {"user", "assistant"}:
                    continue
                content = str(msg.get("content") or "")
                db.add(
                    SitePrompt(
                        project_id=project_id,
                        role=role,
                        content=content,
                        model_used="gemini-stream" if role == "assistant" else None,
                    )
                )

            preview_url = _save_project_files(project_id, normalized_files)

            if normalized_files:
                gs_result = await db.execute(
                    select(GeneratedSite).where(GeneratedSite.project_id == project_id)
                )
                generated = gs_result.scalars().first()
                files_payload = json.dumps({"files": normalized_files}, ensure_ascii=False)
                if generated is None:
                    generated = GeneratedSite(
                        project_id=project_id,
                        structure_json=files_payload,
                        html_path=str(Path(SITES_DIR) / project_id / "index.html"),
                        preview_url=preview_url,
                        status="ready",
                        error_message=None,
                    )
                    db.add(generated)
                else:
                    generated.structure_json = files_payload
                    generated.html_path = str(Path(SITES_DIR) / project_id / "index.html")
                    generated.preview_url = preview_url
                    generated.status = "ready"
                    generated.error_message = None

                commit_hash = _snapshot_hash(normalized_files)
                latest_result = await db.execute(
                    select(SiteGitSnapshot)
                    .where(SiteGitSnapshot.project_id == project_id)
                    .order_by(desc(SiteGitSnapshot.created_at))
                    .limit(1)
                )
                latest = latest_result.scalars().first()
                if latest is None or latest.commit_hash != commit_hash:
                    last_user = ""
                    for msg in reversed(sorted_messages):
                        if msg.get("role") == "user":
                            last_user = str(msg.get("content") or "").strip()
                            break
                    db.add(
                        SiteGitSnapshot(
                            id=str(uuid.uuid4()),
                            project_id=project_id,
                            commit_hash=commit_hash,
                            files_json=files_payload,
                            message=last_user[:300] or "Auto snapshot",
                        )
                    )

            project.status = "ready"
            project.updated_at = datetime.now(timezone.utc)
            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("novidade async db-save failed project_id=%s", project_id)


@router.post("/generate-code", summary="Streaming Gemini code generation")
async def generate_code(
    payload: GenerateCodeRequest,
    current_user: User = Depends(get_current_user),
    subscription: Subscription = Depends(verify_active_subscription),
    db: AsyncSession = Depends(get_db),
):
    await check_and_increment_usage(
        db,
        subscription.workspace_id,
        "text",
        subscription,
    )

    message_dicts = [m.model_dump(by_alias=True) for m in payload.messages]
    attachment_dicts = [dict(a) for a in (payload.attachments or []) if isinstance(a, dict)]

    media_result = await db.execute(
        select(Media)
        .where(
            Media.workspace_id == subscription.workspace_id,
            Media.file_type.like("image/%"),
        )
        .order_by(desc(Media.created_at))
        .limit(40)
    )
    workspace_image_urls = [str(m.file_url or "") for m in media_result.scalars().all() if getattr(m, "file_url", None)]

    # Extract last user message for Pexels keyword search
    last_user_text = ""
    for msg in reversed(message_dicts):
        if msg.get("role") == "user":
            last_user_text = str(msg.get("content") or "").strip()
            break

    pexels_urls: list[str] = []
    try:
        pexels_urls = await fetch_pexels_urls_for_prompt(last_user_text, max_images=6)
    except Exception:
        logger.warning("novidade: Pexels fetch failed, continuing without stock photos")

    async def event_generator():
        full = ""
        try:
            async for delta in stream_gemini_code(
                messages=message_dicts,
                codebase_info=payload.codebase_info,
                attachments=attachment_dicts,
                workspace_image_urls=workspace_image_urls,
                pexels_image_urls=pexels_urls,
            ):
                full += delta
                yield _sse({"type": "text-delta", "delta": delta})
            yield _sse(
                {
                    "type": "done",
                    "id": payload.id,
                    "message": {
                        "role": "assistant",
                        "content": full,
                    },
                }
            )
        except GeminiStreamError as exc:
            # SECURITY: GeminiStreamError messages can contain env var names
            # (GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_CLOUD_PROJECT, etc.).
            # Log the full message server-side; return only a generic error to the client.
            logger.error("novidade GeminiStreamError user=%s: %s", current_user.id, exc)
            yield _sse({"type": "error", "error": "Erro ao gerar resposta do Gemini."})
        except Exception:
            logger.exception("novidade streaming failed user=%s", current_user.id)
            yield _sse({"type": "error", "error": "Erro ao gerar resposta do Gemini."})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chat/db-save", response_model=DbSaveResponse, summary="Async DB save for Novidade chat")
async def chat_db_save(
    payload: DbSaveRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DbSaveResponse:
    project: SiteProject | None = None

    if payload.id:
        result = await db.execute(
            select(SiteProject).where(
                SiteProject.id == payload.id,
                SiteProject.user_id == current_user.id,
            )
        )
        project = result.scalars().first()
        if not project:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Projeto nao encontrado.")

    if not project:
        title = _extract_project_title([m.model_dump(by_alias=True) for m in payload.messages])
        project = SiteProject(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            name=title or "Novidade Chat",
            status="draft",
        )
        db.add(project)
        await db.commit()

    background_tasks.add_task(
        _persist_chat_and_snapshot,
        project_id=project.id,
        user_id=current_user.id,
        messages=[m.model_dump(by_alias=True) for m in payload.messages],
        files=payload.files,
    )

    return DbSaveResponse(id=project.id)


@router.get("/chat/projects/{project_id}", summary="Get novidade project content")
async def get_novidade_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    result = await db.execute(
        select(SiteProject)
        .where(
            SiteProject.id == project_id,
            SiteProject.user_id == current_user.id,
        )
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Projeto nao encontrado.")

    prompts_result = await db.execute(
        select(SitePrompt)
        .where(SitePrompt.project_id == project_id)
        .order_by(SitePrompt.created_at.asc())
    )
    prompts = prompts_result.scalars().all()

    generated_result = await db.execute(
        select(GeneratedSite).where(GeneratedSite.project_id == project_id)
    )
    generated = generated_result.scalars().first()

    files: dict[str, str] = {}
    if generated and generated.structure_json:
        try:
            parsed = json.loads(generated.structure_json)
            files = dict(parsed.get("files") or {})
        except Exception:
            files = {}

    return {
        "projectId": project.id,
        "name": project.name,
        "messages": [
            {
                "id": p.id,
                "role": p.role,
                "content": p.content,
                "createdAt": p.created_at.isoformat(),
            }
            for p in prompts
        ],
        "files": files,
        "previewUrl": generated.preview_url if generated else None,
    }


@router.get(
    "/git/snapshots/{project_id}",
    response_model=list[SnapshotItem],
    summary="List git snapshots for a project",
)
async def list_git_snapshots(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SnapshotItem]:
    project_result = await db.execute(
        select(SiteProject).where(
            SiteProject.id == project_id,
            SiteProject.user_id == current_user.id,
        )
    )
    project = project_result.scalars().first()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Projeto nao encontrado.")

    result = await db.execute(
        select(SiteGitSnapshot)
        .where(SiteGitSnapshot.project_id == project_id)
        .order_by(desc(SiteGitSnapshot.created_at))
        .limit(50)
    )
    rows = result.scalars().all()

    out: list[SnapshotItem] = []
    for row in rows:
        file_count = 0
        try:
            parsed = json.loads(row.files_json)
            file_count = len(dict(parsed.get("files") or {}))
        except Exception:
            file_count = 0
        out.append(
            SnapshotItem(
                id=row.id,
                projectId=row.project_id,
                commitHash=row.commit_hash[:12],
                message=row.message,
                createdAt=row.created_at.isoformat(),
                fileCount=file_count,
            )
        )
    return out
