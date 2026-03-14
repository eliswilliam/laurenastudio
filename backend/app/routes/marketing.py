"""
routes/marketing.py
Marketing AI endpoints — image and video ad generation.
Protected by active subscription + usage limits.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import (
    check_and_increment_usage,
    get_workspace_id,
    verify_active_subscription,
)
from app.db.session import get_db
from app.models.ai_generation import AIGeneration
from app.models.subscription import Subscription
from app.schemas.ai import (
    MarketingImageRequest,
    MarketingImageResponse,
    MarketingVideoRequest,
    MarketingVideoResponse,
)
from app.services.marketing_service import (
    generate_marketing_image,
    generate_marketing_video,
)

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
            detail=f"Falha na geração da imagem: {exc}",
        )

    prompt_log = f"[MKT-IMG] {payload.brand_name} | {payload.ad_text[:80]}"
    record = AIGeneration(
        workspace_id=workspace_id,
        resource_type="image",
        prompt=prompt_log,
        content=result.get("image_url") or result.get("ai_text") or "",
        model_used="gemini-2.5-flash-image",
        style="marketing",
    )
    db.add(record)
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
    response_model=MarketingVideoResponse,
    summary="Generate a marketing ad video",
)
async def marketing_video(
    payload: MarketingVideoRequest,
    workspace_id: str = Depends(get_workspace_id),
    subscription: Subscription = Depends(verify_active_subscription),
    db: AsyncSession = Depends(get_db),
) -> MarketingVideoResponse:
    usage = await check_and_increment_usage(db, workspace_id, "video", subscription)

    try:
        result = await generate_marketing_video(
            brand_name=payload.brand_name,
            ad_text=payload.ad_text,
            user_prompt=payload.prompt,
            video_mode=payload.video_mode,
            reference_image_b64=payload.reference_image_b64,
            reference_mime=payload.reference_mime,
        )
    except Exception as exc:
        logger.exception("Marketing video generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha na geração do vídeo: {exc}",
        )

    prompt_log = f"[MKT-VID:{payload.video_mode}] {payload.brand_name} | {payload.ad_text[:80]}"
    record = AIGeneration(
        workspace_id=workspace_id,
        resource_type="video",
        prompt=prompt_log,
        content=result["video_url"],
        model_used="veo-3.1-generate-001",
        style="marketing",
    )
    db.add(record)
    await db.commit()

    return MarketingVideoResponse(
        video_url=result["video_url"],
        usage_after=usage.video_used,
        limit=subscription.plan.video_limit,
        message="Vídeo publicitário gerado com sucesso.",
    )
