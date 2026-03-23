"""
services/billing_service.py
Business logic for plan activation, cancellation, usage queries, etc.
Integrates with Stripe for real payment processing.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.usage_tracking import UsageTracking
from app.services import notification_service
from app.schemas.billing import (
    ActivatePlanResponse,
    BillingStatusResponse,
    CancelSubscriptionResponse,
    CurrentSubscriptionResponse,
    PlanRead,
    SubscriptionRead,
    SubscriptionWithPlan,
    UsageRead,
    UsageWithLimits,
)

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_plan_by_name(db: AsyncSession, plan_name: str) -> Plan:
    result = await db.execute(
        select(Plan).where(Plan.name == plan_name.lower().strip())
    )
    plan = result.scalars().first()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan '{plan_name}' not found. Valid: starter, pro, business.",
        )
    return plan


async def _get_subscription(
    db: AsyncSession, workspace_id: str
) -> Subscription | None:
    result = await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .where(Subscription.workspace_id == workspace_id)
    )
    return result.scalars().first()


async def _get_usage(
    db: AsyncSession, workspace_id: str
) -> UsageTracking | None:
    result = await db.execute(
        select(UsageTracking).where(UsageTracking.workspace_id == workspace_id)
    )
    return result.scalars().first()


def _remaining(used: int, limit: int) -> int:
    """0 limit = unlimited → return -1 sentinel."""
    if limit == 0:
        return -1  # unlimited
    return max(0, limit - used)


# ── Public helper (used by routes/billing.py for customer portal) ─────────────

async def get_subscription_for_workspace(
    db: AsyncSession, workspace_id: str
) -> Subscription | None:
    """Return the subscription model for a workspace (with Stripe IDs)."""
    return await _get_subscription(db, workspace_id)


# ── List plans ────────────────────────────────────────────────────────────────

async def list_plans(db: AsyncSession) -> list[PlanRead]:
    result = await db.execute(select(Plan).order_by(Plan.price_brl.asc()))
    plans = result.scalars().all()
    return [PlanRead.model_validate(p) for p in plans]


# ── Activate plan (called by Stripe webhook OR dev simulation route) ──────────

async def activate_plan(
    db: AsyncSession,
    workspace_id: str,
    plan_name: str,
    *,
    stripe_customer_id: str | None = None,
    stripe_subscription_id: str | None = None,
) -> ActivatePlanResponse:
    plan = await _get_plan_by_name(db, plan_name)
    now = datetime.now(timezone.utc)
    period_end = now + timedelta(days=30)

    # If we have a stripe subscription, try to get the real period_end
    if stripe_subscription_id:
        try:
            from app.services.stripe_service import (
                parse_period_end,
                retrieve_stripe_subscription,
            )
            stripe_sub = retrieve_stripe_subscription(stripe_subscription_id)
            period_end = parse_period_end(stripe_sub)
        except Exception as e:
            logger.warning("Could not fetch Stripe period_end: %s", e)

    # Upsert subscription
    sub = await _get_subscription(db, workspace_id)
    old_plan_display = sub.plan.display_name if sub and sub.plan else None
    if sub:
        sub.plan_id = plan.id
        sub.status = "active"
        sub.start_date = now
        sub.current_period_end = period_end
        if stripe_customer_id:
            sub.stripe_customer_id = stripe_customer_id
        if stripe_subscription_id:
            sub.stripe_subscription_id = stripe_subscription_id
    else:
        sub = Subscription(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            plan_id=plan.id,
            status="active",
            start_date=now,
            current_period_end=period_end,
            stripe_customer_id=stripe_customer_id,
            stripe_subscription_id=stripe_subscription_id,
        )
        db.add(sub)

    # Upsert usage tracking
    usage = await _get_usage(db, workspace_id)
    if usage:
        usage.text_used = 0
        usage.image_used = 0
        usage.video_used = 0
        usage.posts_used = 0
        usage.period_start = now
        usage.period_end = period_end
    else:
        usage = UsageTracking(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            text_used=0,
            image_used=0,
            video_used=0,
            posts_used=0,
            period_start=now,
            period_end=period_end,
        )
        db.add(usage)

    await db.commit()
    await db.refresh(sub)
    await db.refresh(usage)

    owner_id = await notification_service.workspace_owner_id(db, workspace_id)
    if owner_id:
        if old_plan_display and old_plan_display != plan.display_name:
            await notification_service.create_user_notification(
                db,
                user_id=owner_id,
                kind="plan_change",
                title="Plano alterado",
                body=(
                    f"Seu plano foi alterado de «{old_plan_display}» para «{plan.display_name}». "
                    "Os limites de uso foram atualizados."
                ),
            )
        else:
            await notification_service.create_user_notification(
                db,
                user_id=owner_id,
                kind="plan_activated",
                title="Plano ativado",
                body=f"Seu plano «{plan.display_name}» está ativo. Obrigado por assinar!",
            )
        await db.commit()

    return ActivatePlanResponse(
        message=f"Plan '{plan.display_name}' activated successfully.",
        subscription=SubscriptionRead.model_validate(sub),
        usage=UsageRead.model_validate(usage),
    )


# ── Cancel subscription ──────────────────────────────────────────────────────

async def cancel_subscription(
    db: AsyncSession,
    workspace_id: str,
) -> CancelSubscriptionResponse:
    sub = await _get_subscription(db, workspace_id)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No subscription found for this workspace.",
        )

    if sub.status == "canceled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription is already canceled.",
        )

    # Cancel on Stripe if we have a Stripe subscription ID
    if sub.stripe_subscription_id:
        try:
            from app.services.stripe_service import cancel_stripe_subscription
            cancel_stripe_subscription(sub.stripe_subscription_id)
            logger.info(
                "Stripe subscription %s canceled for workspace %s",
                sub.stripe_subscription_id, workspace_id,
            )
        except Exception as e:
            logger.error("Failed to cancel Stripe subscription: %s", e)
            # Continue with local cancellation even if Stripe fails

    owner_id = await notification_service.workspace_owner_id(db, workspace_id)

    sub.status = "canceled"
    await db.commit()
    await db.refresh(sub)

    if owner_id:
        await notification_service.create_user_notification(
            db,
            user_id=owner_id,
            kind="plan_canceled",
            title="Assinatura cancelada",
            body="Sua assinatura foi encerrada. Recursos do plano pago não estão mais disponíveis.",
        )
        await db.commit()

    return CancelSubscriptionResponse(
        message="Subscription canceled. Access blocked immediately.",
        subscription=SubscriptionRead.model_validate(sub),
    )


# ── Change plan ──────────────────────────────────────────────────────────────

async def change_plan(
    db: AsyncSession,
    workspace_id: str,
    plan_name: str,
) -> ActivatePlanResponse:
    """
    Change to a different plan. Keeps the subscription active but
    updates the plan and resets usage counters.
    """
    sub = await _get_subscription(db, workspace_id)
    if not sub or sub.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active subscription to change. Activate a plan first.",
        )

    old_plan_display = sub.plan.display_name if sub.plan else None

    plan = await _get_plan_by_name(db, plan_name)
    now = datetime.now(timezone.utc)
    period_end = now + timedelta(days=30)

    sub.plan_id = plan.id
    sub.start_date = now
    sub.current_period_end = period_end

    # Reset usage for the new plan period
    usage = await _get_usage(db, workspace_id)
    if usage:
        usage.text_used = 0
        usage.image_used = 0
        usage.video_used = 0
        usage.posts_used = 0
        usage.period_start = now
        usage.period_end = period_end

    await db.commit()
    await db.refresh(sub)
    if usage:
        await db.refresh(usage)

    owner_id = await notification_service.workspace_owner_id(db, workspace_id)
    if owner_id and old_plan_display and old_plan_display != plan.display_name:
        await notification_service.create_user_notification(
            db,
            user_id=owner_id,
            kind="plan_change",
            title="Plano alterado",
            body=(
                f"Seu plano foi alterado de «{old_plan_display}» para «{plan.display_name}». "
                "Os contadores de uso foram zerados para o novo período."
            ),
        )
        await db.commit()

    return ActivatePlanResponse(
        message=f"Plan changed to '{plan.display_name}' successfully.",
        subscription=SubscriptionRead.model_validate(sub),
        usage=UsageRead.model_validate(usage) if usage else None,
    )


# ── Get billing status ───────────────────────────────────────────────────────

async def get_billing_status(
    db: AsyncSession,
    workspace_id: str,
) -> BillingStatusResponse:
    sub = await _get_subscription(db, workspace_id)
    usage = await _get_usage(db, workspace_id)

    if not sub:
        return BillingStatusResponse(
            subscription=None,
            usage=None,
            is_active=False,
        )

    # Eagerly load plan if not already loaded
    if not sub.plan:
        plan = await _get_plan_by_name(db, "starter")  # fallback
    else:
        plan = sub.plan

    sub_read = SubscriptionWithPlan(
        id=sub.id,
        workspace_id=sub.workspace_id,
        plan_id=sub.plan_id,
        status=sub.status,
        start_date=sub.start_date,
        current_period_end=sub.current_period_end,
        stripe_customer_id=sub.stripe_customer_id,
        stripe_subscription_id=sub.stripe_subscription_id,
        plan=PlanRead.model_validate(plan),
    )

    usage_with_limits = None
    if usage:
        usage_read = UsageRead.model_validate(usage)
        usage_with_limits = UsageWithLimits(
            usage=usage_read,
            limits=PlanRead.model_validate(plan),
            text_remaining=_remaining(usage.text_used, plan.text_limit),
            image_remaining=_remaining(usage.image_used, plan.image_limit),
            video_remaining=_remaining(usage.video_used, plan.video_limit),
            posts_remaining=_remaining(usage.posts_used, plan.post_limit),
        )

    return BillingStatusResponse(
        subscription=sub_read,
        usage=usage_with_limits,
        is_active=sub.status == "active",
    )


# ── Get usage only ───────────────────────────────────────────────────────────

async def get_usage(
    db: AsyncSession,
    workspace_id: str,
) -> UsageWithLimits:
    sub = await _get_subscription(db, workspace_id)
    if not sub or sub.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No active subscription.",
        )

    usage = await _get_usage(db, workspace_id)
    if not usage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usage tracker not found.",
        )

    plan = sub.plan
    usage_read = UsageRead.model_validate(usage)

    return UsageWithLimits(
        usage=usage_read,
        limits=PlanRead.model_validate(plan),
        text_remaining=_remaining(usage.text_used, plan.text_limit),
        image_remaining=_remaining(usage.image_used, plan.image_limit),
        video_remaining=_remaining(usage.video_used, plan.video_limit),
        posts_remaining=_remaining(usage.posts_used, plan.post_limit),
    )


# ── Get current subscription (simplified) ────────────────────────────────────

async def get_current_subscription(
    db: AsyncSession,
    workspace_id: str,
) -> CurrentSubscriptionResponse:
    sub = await _get_subscription(db, workspace_id)

    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma assinatura encontrada para este workspace.",
        )

    plan = sub.plan
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Plano da assinatura não encontrado.",
        )

    usage = await _get_usage(db, workspace_id)
    usage_read = UsageRead.model_validate(usage) if usage else None

    return CurrentSubscriptionResponse(
        plan_name=plan.name,
        display_name=plan.display_name,
        price=float(plan.price_brl),
        status=sub.status,
        current_period_end=sub.current_period_end.isoformat() if sub.current_period_end else None,
        limits=PlanRead.model_validate(plan),
        usage=usage_read,
    )
