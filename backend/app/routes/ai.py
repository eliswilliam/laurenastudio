"""
routes/ai.py
AI generation endpoints — protected by active subscription + usage limits.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import (
    check_and_increment_usage,
    get_workspace_id,
    verify_active_subscription,
)
from app.db.session import get_db
from app.models.subscription import Subscription
from app.schemas.ai import AIGenerateRequest, AIGenerateResponse

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

    # ── Placeholder for actual AI generation ─────────────────────────────
    # In production, call OpenAI / Stable Diffusion / Runway API here.
    generated_content = (
        f"[AI-generated {payload.resource_type}] "
        f"Prompt: '{payload.prompt[:100]}' — "
        f"This is a placeholder. Integrate your AI provider here."
    )

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
