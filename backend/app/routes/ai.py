"""
routes/ai.py
AI generation endpoints — protected by active subscription + usage limits.
Uses Google Gemini for real text and image generation, persists results to DB.
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
from app.models.user import User
from app.routes.auth import get_current_user
from app.services import notification_service
from app.schemas.ai import AIGenerateRequest, AIGenerateResponse
from app.services.ai_service import generate_image, generate_text, generate_video

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Generation"])


@router.post(
    "/generate",
    response_model=AIGenerateResponse,
    summary="Generate AI content (text, image, or video)",
    description=(
        "Requires active subscription. Checks and increments the usage counter "
        "for the specified resource type. Returns 403 if limit exceeded."
    ),
)
async def generate(
    payload: AIGenerateRequest,
    workspace_id: str = Depends(get_workspace_id),
    subscription: Subscription = Depends(verify_active_subscription),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AIGenerateResponse:
    # Validate resource type
    if payload.resource_type not in ("text", "image", "video"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="resource_type must be 'text', 'image', or 'video'.",
        )

    # Check limit & increment counter
    usage = await check_and_increment_usage(
        db, workspace_id, payload.resource_type, subscription
    )

    # ── Real AI generation via Google Gemini ─────────────────────────────
    try:
        if payload.resource_type == "text":
            generated_content = await generate_text(
                payload.prompt,
                model=payload.model,
                style=payload.style,
            )
        elif payload.resource_type == "image":
            generated_content = await generate_image(
                payload.prompt,
                model=payload.model,
                style=payload.style,
            )
        elif payload.resource_type == "video":
            generated_content = await generate_video(
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

    # ── Persist to database ──────────────────────────────────────────────
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
    elif payload.resource_type == "video":
        await notification_service.create_user_notification(
            db,
            user_id=current_user.id,
            kind="ai_video",
            title="Vídeo gerado",
            body="Seu vídeo foi gerado com sucesso no AI Studio.",
        )
        await db.commit()

    # Map resource type to usage field
    field_map = {
        "text": ("text_used", "text_limit"),
        "image": ("image_used", "image_limit"),
        "video": ("video_used", "video_limit"),
    }
    used_field, limit_field = field_map[payload.resource_type]

    return AIGenerateResponse(
        resource_type=payload.resource_type,
        content=generated_content,
        usage_after=getattr(usage, used_field),
        limit=getattr(subscription.plan, limit_field),
        message="Content generated successfully.",
    )
