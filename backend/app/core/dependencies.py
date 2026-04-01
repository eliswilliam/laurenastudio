"""
core/dependencies.py
Shared FastAPI dependencies for subscription verification and usage control.
Resolves the tenant id from the authenticated user's membership — never trusts
the frontend.
"""
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.membership import Membership
from app.models.subscription import Subscription
from app.models.usage_tracking import UsageTracking
from app.models.plan import Plan
from app.routes.auth import get_current_user


# ── Get workspace_id from JWT (via membership) ──────────────────────────────

async def get_workspace_id(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> str:
    """
    Primary tenant id from membership (subscriptions, usage, sites are scoped here).
    Never trusts ids from the client — always derived from the token.
    """
    result = await db.execute(
        select(Membership)
        .where(Membership.user_id == current_user.id)
        .order_by(Membership.created_at.asc())
        .limit(1)
    )
    membership = result.scalars().first()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta não encontrada para este utilizador.",
        )
    return membership.workspace_id


# ── Verify active subscription ───────────────────────────────────────────────

async def verify_active_subscription(
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> Subscription:
    """
    Dependency that blocks access if the account has no active subscription.
    Returns the Subscription ORM object for downstream use.
    """
    result = await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .where(
            Subscription.workspace_id == workspace_id,
            Subscription.status == "active",
        )
    )
    subscription = result.scalars().first()

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active subscription required. Please subscribe to a plan.",
        )

    if subscription.current_period_end and datetime.now(timezone.utc) >= subscription.current_period_end:
        subscription.status = "canceled"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Subscription period ended. Please choose a new plan.",
        )

    return subscription


# ── Reset usage if period expired ────────────────────────────────────────────

async def _reset_usage_if_needed(
    db: AsyncSession,
    usage: UsageTracking,
) -> UsageTracking:
    """
    If the current billing period has expired, reset all counters and
    advance to the next period (+30 days).
    """
    now = datetime.now(timezone.utc)
    if now > usage.period_end:
        usage.text_used = 0
        usage.image_used = 0
        usage.video_used = 0
        usage.posts_used = 0
        usage.audio_used = 0
        usage.site_publishes_used = 0
        usage.period_start = now
        from datetime import timedelta
        usage.period_end = now + timedelta(days=30)
        await db.flush()
    return usage


# ── Check and increment usage ────────────────────────────────────────────────

RESOURCE_MAP = {
    "text": ("text_used", "text_limit"),
    "image": ("image_used", "image_limit"),
    "video": ("video_used", "video_limit"),
    "audio": ("audio_used", "audio_limit"),
    "site_publish": ("site_publishes_used", "site_publish_limit"),
}

# Libellés pour message 403 (PT-BR)
_RESOURCE_LIMIT_LABEL_PT: dict[str, str] = {
    "text": "gerações de texto com IA",
    "image": "gerações de imagem",
    "video": "gerações de vídeo",
    "audio": "gerações de áudio",
    "site_publish": "publicações de site",
}


async def check_and_increment_usage(
    db: AsyncSession,
    workspace_id: str,
    resource_type: str,
    subscription: Subscription,
) -> UsageTracking:
    """
    Core usage gate:
    1. Fetch (or lazy-create) the workspace usage tracker
    2. Reset counters if period expired
    3. Check limit for the resource type
    4. If within limit → increment; otherwise → HTTP 403
    """
    if resource_type not in RESOURCE_MAP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown resource type: {resource_type}",
        )

    used_field, limit_field = RESOURCE_MAP[resource_type]

    # Fetch usage
    result = await db.execute(
        select(UsageTracking).where(UsageTracking.workspace_id == workspace_id)
    )
    usage = result.scalars().first()

    if not usage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usage tracking not initialized. Please activate a plan first.",
        )

    # Auto-reset if period expired
    usage = await _reset_usage_if_needed(db, usage)

    # Check limit (0 = unlimited)
    plan = subscription.plan
    limit_value = getattr(plan, limit_field)
    current_used = getattr(usage, used_field)

    if limit_value > 0 and current_used >= limit_value:
        label = _RESOURCE_LIMIT_LABEL_PT.get(resource_type, resource_type)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Limite mensal atingido para {label} "
                f"({current_used}/{limit_value}). "
                f"Atualize o plano para continuar."
            ),
        )

    # Increment
    setattr(usage, used_field, current_used + 1)
    await db.flush()

    return usage
