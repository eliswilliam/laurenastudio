"""
routes/posts.py
Social media post endpoints — protected by active subscription + usage limits.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import (
    check_and_increment_usage,
    get_workspace_id,
    verify_active_subscription,
)
from app.db.session import get_db
from app.models.subscription import Subscription
from app.schemas.posts import CreatePostRequest, PostResponse

router = APIRouter(prefix="/posts", tags=["Posts"])


@router.post(
    "",
    response_model=PostResponse,
    summary="Create a social media post",
    description=(
        "Requires active subscription. Checks and increments the post usage counter. "
        "Returns 403 if limit exceeded."
    ),
)
async def create_post(
    payload: CreatePostRequest,
    workspace_id: str = Depends(get_workspace_id),
    subscription: Subscription = Depends(verify_active_subscription),
    db: AsyncSession = Depends(get_db),
) -> PostResponse:
    # Check post limit & increment
    usage = await check_and_increment_usage(
        db, workspace_id, "post", subscription
    )

    # ── Placeholder: persist the post to a `posts` table in the future ──
    # For now we return a mock response proving the gate works.
    now = datetime.now(timezone.utc)

    return PostResponse(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        title=payload.title,
        content=payload.content,
        platform=payload.platform,
        scheduled_at=payload.scheduled_at,
        created_at=now,
        usage_after=usage.posts_used,
        limit=subscription.plan.post_limit,
        message="Post created successfully.",
    )
