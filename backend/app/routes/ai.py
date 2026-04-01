"""
routes/ai.py
AI generation endpoints — protected by active subscription + usage limits.
Uses Google Gemini for text; Replicate (FLUX) for image; Replicate Minimax (video); Azure Speech for audio only.
Video runs in an ARQ worker so HTTP returns 202 quickly (avoids nginx/Azure 504).
"""
import asyncio
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import (
    check_and_increment_usage,
    get_workspace_id,
    verify_active_subscription,
)
from app.db.session import get_db
from app.models.ai_generation import AIGeneration
from app.models.subscription import Subscription
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.ai import (
    AIGenerateRequest,
    AIGenerateResponse,
    AIVideoJobAccepted,
)
from app.schemas.job import BackgroundJobResponse
from app.services import notification_service
from app.services.ai_service import generate_image, generate_text
from app.services.arq_enqueue import enqueue_ai_video_job
from app.services.job_service import create_job, get_job
from app.services.replicate_image_service import GEMINI_IMAGE_MODEL
from app.services.speech_service import save_speech_wav_to_uploads

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Generation"])


@router.get(
    "/jobs/{job_id}",
    response_model=BackgroundJobResponse,
    summary="Poll AI video job (Minimax) status",
)
async def get_ai_video_job(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BackgroundJobResponse:
    row = await get_job(db, job_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    if row.job_type != "ai_video":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    return BackgroundJobResponse.from_model(row)


@router.post(
    "/generate",
    response_model=None,
    summary="Generate AI content (text, image, video, or audio)",
    description=(
        "Requires active subscription. Text uses Gemini; image uses Replicate (FLUX). Audio uses Azure Speech only. "
        "Video returns 202 with jobId — poll GET /ai/jobs/{job_id} until status is success."
    ),
)
async def generate(
    payload: AIGenerateRequest,
    workspace_id: str = Depends(get_workspace_id),
    subscription: Subscription = Depends(verify_active_subscription),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse | AIGenerateResponse:
    if payload.resource_type not in ("text", "image", "video", "audio"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="resource_type must be 'text', 'image', 'video', or 'audio'.",
        )

    usage = await check_and_increment_usage(
        db, workspace_id, payload.resource_type, subscription
    )

    field_map = {
        "text": ("text_used", "text_limit"),
        "image": ("image_used", "image_limit"),
        "video": ("video_used", "video_limit"),
        "audio": ("audio_used", "audio_limit"),
    }
    used_field, limit_field = field_map[payload.resource_type]

    # ── Video: queue ARQ (Video can take several minutes; avoids proxy 504) ─────
    if payload.resource_type == "video":
        if not payload.reference_image_b64:
            raise HTTPException(
                status_code=400,
                detail="Veuillez ajouter une image pour générer la vidéo."
            )
            
        job = await create_job(
            db,
            job_type="ai_video",
            user_id=current_user.id,
            project_id=None,
            input_payload={
                "mode": "studio",
                "prompt": payload.prompt,
                "style": payload.style,
                "reference_image_b64": payload.reference_image_b64,
                "reference_mime": payload.reference_mime,
                "workspace_id": workspace_id,
                "user_id": current_user.id,
                "usage_after": getattr(usage, used_field),
                "limit": getattr(subscription.plan, limit_field),
            },
        )
        await db.commit()
        await enqueue_ai_video_job(str(job.id))
        logger.info("AI video job enqueued job_id=%s user=%s", job.id, current_user.id)
        body = AIVideoJobAccepted(
            job_id=str(job.id),
            usage_after=getattr(usage, used_field),
            limit=getattr(subscription.plan, limit_field),
        )
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content=body.model_dump(by_alias=True),
        )

    # ── Audio: Azure Speech only (never Gemini / Google API key) ─────────────
    if payload.resource_type == "audio":
        try:
            voice_to_use = payload.model if payload.model and payload.model.lower() != "azure" else None
            generated_content = await asyncio.to_thread(
                save_speech_wav_to_uploads,
                payload.prompt,
                voice_to_use,
            )
        except RuntimeError as exc:
            logger.exception("Azure speech generation failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Falha na síntese de voz. Tente novamente em instantes.",
            ) from exc
        except Exception as exc:
            logger.exception("Azure speech generation failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Falha na síntese de voz. Tente novamente em instantes.",
            ) from exc

        record = AIGeneration(
            workspace_id=workspace_id,
            resource_type="audio",
            prompt=payload.prompt,
            content=generated_content,
            model_used=payload.model or "azure-speech",
            style=payload.style,
        )
        db.add(record)
        await db.commit()

        return AIGenerateResponse(
            resource_type="audio",
            content=generated_content,
            usage_after=getattr(usage, used_field),
            limit=getattr(subscription.plan, limit_field),
            message="Áudio gerado com sucesso.",
        )

    # ── Text (Gemini) / imagem (Replicate FLUX) ───────────────────────────────
    try:
        if payload.resource_type == "text":
            generated_content = await generate_text(
                payload.prompt,
                model=payload.model,
                style=payload.style,
            )
        else:
            generated_content = await generate_image(
                payload.prompt,
                model=payload.model,
                style=payload.style,
            )
    except Exception as exc:
        logger.exception("AI generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Falha na geração com IA. Tente novamente em instantes.",
        )

    model_logged = (
        GEMINI_IMAGE_MODEL
        if payload.resource_type == "image"
        else payload.model
    )
    record = AIGeneration(
        workspace_id=workspace_id,
        resource_type=payload.resource_type,
        prompt=payload.prompt,
        content=generated_content,
        model_used=model_logged,
        style=payload.style,
    )
    db.add(record)
    await db.commit()

    if payload.resource_type == "image":
        await notification_service.create_user_notification(
            db,
            user_id=current_user.id,
            kind="ai_image",
            title="Imagem gerada",
            body="Sua imagem foi gerada com sucesso no AI Studio.",
        )
        await db.commit()

    return AIGenerateResponse(
        resource_type=payload.resource_type,
        content=generated_content,
        usage_after=getattr(usage, used_field),
        limit=getattr(subscription.plan, limit_field),
        message="Content generated successfully.",
    )
