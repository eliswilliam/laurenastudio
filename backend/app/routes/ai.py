"""
routes/ai.py
AI generation endpoints — protected by active subscription + usage limits.
Uses Google Gemini for real text and image generation, persists results to DB.
Video (Veo) runs in an ARQ worker so HTTP returns 202 quickly (avoids nginx/Azure 504).
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Generation"])


@router.get(
    "/jobs/{job_id}",
    response_model=BackgroundJobResponse,
    summary="Poll AI video job (Veo) status",
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
    summary="Generate AI content (text, image, or video)",
    description=(
        "Requires active subscription. Text and image return 200 with content. "
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
    if payload.resource_type not in ("text", "image", "video"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="resource_type must be 'text', 'image', or 'video'.",
        )

    usage = await check_and_increment_usage(
        db, workspace_id, payload.resource_type, subscription
    )

    field_map = {
        "text": ("text_used", "text_limit"),
        "image": ("image_used", "image_limit"),
        "video": ("video_used", "video_limit"),
    }
    used_field, limit_field = field_map[payload.resource_type]

    # ── Video: queue ARQ (Veo can take several minutes; avoids proxy 504) ─────
    if payload.resource_type == "video":
        job = await create_job(
            db,
            job_type="ai_video",
            user_id=current_user.id,
            project_id=None,
            input_payload={
                "mode": "studio",
                "prompt": payload.prompt,
                "style": payload.style,
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

    # ── Text / image: synchronous ───────────────────────────────────────────
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
            detail=f"Falha na geração com IA: {exc}",
        )

    record = AIGeneration(
        workspace_id=workspace_id,
        resource_type=payload.resource_type,
        prompt=payload.prompt,
        content=generated_content,
        model_used=payload.model,
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
