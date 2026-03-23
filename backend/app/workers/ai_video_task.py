"""
ARQ task: Veo video generation (AI Studio + Marketing) — runs off the HTTP request
so nginx / Azure do not return 504 while polling Vertex for several minutes.
"""
from __future__ import annotations

import asyncio
import logging
from functools import partial
from uuid import UUID

from app.db.worker_db import WorkerSessionLocal
from app.models.ai_generation import AIGeneration
from app.services import notification_service
from app.services.ai_service import _sync_generate_video
from app.services.job_service import append_log, get_job, mark_failed, mark_running, mark_success
from app.services.marketing_service import generate_marketing_video

logger = logging.getLogger(__name__)

MAX_AI_VIDEO_TASK_S = 1200


async def _handle_ai_video_timeout(job_id: UUID) -> None:
    async with WorkerSessionLocal() as db:
        await append_log(db, job_id, "Timeout: geração de vídeo excedeu o tempo máximo.")
        await mark_failed(db, job_id, "timeout")
        await db.commit()


async def _arq_ai_video_impl(job_id: str) -> None:
    jid = UUID(job_id)
    async with WorkerSessionLocal() as db:
        job = await get_job(db, jid)
        if not job:
            logger.error("ai_video task: job not found %s", job_id)
            return

        payload = job.input_payload or {}
        mode = payload.get("mode") or "studio"

        await mark_running(db, jid)
        await db.commit()

        await append_log(db, jid, "Iniciando geração de vídeo (Vertex Veo)…")
        await db.commit()

        try:
            if mode == "studio":
                prompt = str(payload.get("prompt") or "")
                style = payload.get("style")
                workspace_id = str(payload.get("workspace_id") or "")
                user_id = str(payload.get("user_id") or "")
                usage_after = int(payload.get("usage_after") or 0)
                limit = int(payload.get("limit") or 0)

                logger.info("[ai_video][studio] job=%s prompt_len=%s", job_id, len(prompt))
                content_url = await asyncio.to_thread(
                    partial(_sync_generate_video, prompt, style=style),
                )

                record = AIGeneration(
                    workspace_id=workspace_id,
                    resource_type="video",
                    prompt=prompt[:4000],
                    content=content_url,
                    model_used="veo-3.1-generate-001",
                    style=style,
                )
                db.add(record)
                await db.flush()

                await notification_service.create_user_notification(
                    db,
                    user_id=user_id,
                    kind="ai_video",
                    title="Vídeo gerado",
                    body="Seu vídeo foi gerado com sucesso no AI Studio.",
                )

                await mark_success(
                    db,
                    jid,
                    {
                        "content": content_url,
                        "resource_type": "video",
                        "usage_after": usage_after,
                        "limit": limit,
                        "message": "Content generated successfully.",
                    },
                )
                await db.commit()
                logger.info("[ai_video][studio] job=%s done url=%s", job_id, content_url[:80])

            elif mode == "marketing":
                workspace_id = str(payload.get("workspace_id") or "")
                user_id = str(payload.get("user_id") or "")
                usage_after = int(payload.get("usage_after") or 0)
                limit = int(payload.get("limit") or 0)

                logger.info("[ai_video][marketing] job=%s", job_id)
                result = await generate_marketing_video(
                    brand_name=str(payload.get("brand_name") or ""),
                    ad_text=str(payload.get("ad_text") or ""),
                    user_prompt=payload.get("user_prompt"),
                    video_mode=str(payload.get("video_mode") or "text_to_video"),
                    reference_image_b64=payload.get("reference_image_b64"),
                    reference_mime=str(payload.get("reference_mime") or "image/png"),
                )
                video_url = result.get("video_url") or ""
                prompt_log = (
                    f"[MKT-VID:{payload.get('video_mode')}] "
                    f"{payload.get('brand_name', '')} | {str(payload.get('ad_text', ''))[:80]}"
                )
                record = AIGeneration(
                    workspace_id=workspace_id,
                    resource_type="video",
                    prompt=prompt_log[:4000],
                    content=video_url,
                    model_used="veo-3.1-generate-001",
                    style="marketing",
                )
                db.add(record)
                await db.flush()

                await notification_service.create_user_notification(
                    db,
                    user_id=user_id,
                    kind="marketing_video",
                    title="Vídeo publicitário pronto",
                    body=f"Seu vídeo para a marca «{str(payload.get('brand_name', '')).strip()}» foi gerado com sucesso.",
                )

                await mark_success(
                    db,
                    jid,
                    {
                        "video_url": video_url,
                        "usage_after": usage_after,
                        "limit": limit,
                        "message": "Vídeo publicitário gerado com sucesso.",
                    },
                )
                await db.commit()
                logger.info("[ai_video][marketing] job=%s done", job_id)

            else:
                await mark_failed(db, jid, f"Unknown ai_video mode: {mode}")
                await db.commit()
                raise RuntimeError(f"Unknown mode {mode}")

        except Exception as exc:
            logger.exception("ai_video task error job=%s", job_id)
            jcur = await get_job(db, jid)
            if jcur and jcur.status == "failed":
                raise
            msg = str(exc)[:4000]
            await append_log(db, jid, f"Erro: {msg}")
            await mark_failed(db, jid, msg)
            await db.commit()
            raise


async def arq_ai_video(ctx: dict, job_id: str) -> None:
    jid = UUID(job_id)
    try:
        await asyncio.wait_for(_arq_ai_video_impl(job_id), timeout=MAX_AI_VIDEO_TASK_S)
    except asyncio.TimeoutError:
        logger.warning("ai_video task exceeded %ss: %s", MAX_AI_VIDEO_TASK_S, job_id)
        await _handle_ai_video_timeout(jid)
