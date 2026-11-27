"""
routes/marketing.py
Marketing AI endpoints — image and video ad generation.
Protected by active subscription + usage limits.
"""
import logging

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
from app.services import notification_service
from app.schemas.ai import (
    MarketingImageRequest,
    MarketingImageResponse,
    MarketingVideoJobAccepted,
    MarketingVideoRequest,
)
from app.services.arq_enqueue import enqueue_ai_video_job
from app.services.job_service import create_job
from app.core.config import settings
from app.services.marketing_service import generate_marketing_image
from app.services.gemini_vertex_image_service import GEMINI_IMAGE_MODEL

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/marketing", tags=["Marketing AI"])


@router.post(
    "/generate-image",
    response_model=MarketingImageResponse,
    summary="Generate a marketing ad image",
)
async def marketing_image(
    payload: MarketingImageRequest,
    workspace_id: str = Depends(get_workspace_id),
    subscription: Subscription = Depends(verify_active_subscription),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MarketingImageResponse:
    usage = await check_and_increment_usage(db, workspace_id, "image", subscription)

    try:
        result = await generate_marketing_image(
            brand_name=payload.brand_name,
            ad_text=payload.ad_text,
            user_prompt=payload.prompt,
            reference_image_b64=payload.reference_image_b64,
            reference_mime=payload.reference_mime,
        )
    except Exception as exc:
        logger.exception("Marketing image generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="IMAGE_GENERATION_FAILED",
        )

    prompt_log = f"[MKT-IMG] {payload.brand_name} | {payload.ad_text[:80]}"
    record = AIGeneration(
        workspace_id=workspace_id,
        resource_type="image",
        prompt=prompt_log,
        content=result.get("image_url") or result.get("ai_text") or "",
        model_used=GEMINI_IMAGE_MODEL,
        style="marketing",
    )
    db.add(record)
    await db.commit()

    await notification_service.create_user_notification(
        db,
        user_id=current_user.id,
        kind="marketing_image",
        title="Imagem publicitária pronta",
        body=f"Sua imagem para a marca «{payload.brand_name.strip()}» foi gerada com sucesso.",
    )
    await db.commit()

    return MarketingImageResponse(
        image_url=result.get("image_url"),
        ai_text=result.get("ai_text"),
        usage_after=usage.image_used,
        limit=subscription.plan.image_limit,
        message="Imagem publicitária gerada com sucesso.",
    )


@router.post(
    "/generate-video",
    response_model=None,
    summary="Generate a marketing ad video (queued; poll GET /api/v1/ai/jobs/{jobId})",
)
async def marketing_video(
    payload: MarketingVideoRequest,
    workspace_id: str = Depends(get_workspace_id),
    subscription: Subscription = Depends(verify_active_subscription),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    if not payload.reference_image_b64:
        raise HTTPException(
            status_code=400,
            detail="IMAGE_REQUIRED_FOR_VIDEO"
        )

    usage = await check_and_increment_usage(db, workspace_id, "video", subscription)

    job = await create_job(
        db,
        job_type="ai_video",
        user_id=current_user.id,
        project_id=None,
        input_payload={
            "mode": "marketing",
            "brand_name": payload.brand_name,
            "ad_text": payload.ad_text,
            "user_prompt": payload.prompt,
            "video_mode": payload.video_mode,
            "reference_image_b64": payload.reference_image_b64,
            "reference_mime": payload.reference_mime,
            "workspace_id": workspace_id,
            "user_id": current_user.id,
            "usage_after": usage.video_used,
            "limit": subscription.plan.video_limit,
        },
    )
    await db.commit()
    await enqueue_ai_video_job(str(job.id))
    logger.info("Marketing video job enqueued job_id=%s", job.id)

    body = MarketingVideoJobAccepted(
        job_id=str(job.id),
        usage_after=usage.video_used,
        limit=subscription.plan.video_limit,
    )
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content=body.model_dump(by_alias=True),
    )
