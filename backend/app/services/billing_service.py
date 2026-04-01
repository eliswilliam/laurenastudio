"""
services/billing_service.py
Business logic for plan activation, cancellation, usage queries, upgrades,
and scheduled downgrades.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.usage_tracking import UsageTracking
from app.schemas.billing import (
    ActivatePlanResponse,
    BillingStatusResponse,
    CancelSubscriptionResponse,
    ChangePlanResponse,
    CurrentSubscriptionResponse,
    PlanRead,
    SubscriptionRead,
    SubscriptionWithPlan,
    UsageRead,
    UsageWithLimits,
)
from app.services import notification_service

logger = logging.getLogger(__name__)

PLAN_ORDER = {
    "starter": 1,
    "pro": 2,
    "business": 3,
}


# Helpers


def _coerce_cycle(value: str | None) -> Literal["monthly", "annual"]:
    return "annual" if value == "annual" else "monthly"


def _plan_rank(plan_name: str) -> int:
    return PLAN_ORDER.get(plan_name, 0)


async def _get_plan_by_name(db: AsyncSession, plan_name: str) -> Plan:
    result = await db.execute(select(Plan).where(Plan.name == plan_name.lower().strip()))
    plan = result.scalars().first()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan '{plan_name}' not found. Valid: starter, pro, business.",
        )
    return plan


async def _get_subscription(db: AsyncSession, workspace_id: str) -> Subscription | None:
    result = await db.execute(
        select(Subscription)
        .options(
            selectinload(Subscription.plan),
            selectinload(Subscription.next_plan),
        )
        .where(Subscription.workspace_id == workspace_id)
    )
    return result.scalars().first()


async def _get_usage(db: AsyncSession, workspace_id: str) -> UsageTracking | None:
    result = await db.execute(
        select(UsageTracking).where(UsageTracking.workspace_id == workspace_id)
    )
    return result.scalars().first()


def _remaining(used: int, limit: int) -> int:
    """0 limit = unlimited -> return -1 sentinel."""
    if limit == 0:
        return -1
    return max(0, limit - used)


def _subscription_read(
    sub: Subscription,
    *,
    billing_cycle: Literal["monthly", "annual"] | None = None,
    cancel_at_period_end: bool = False,
    current_price_brl: float | None = None,
    currency: str | None = None,
) -> SubscriptionRead:
    return SubscriptionRead(
        id=sub.id,
        workspace_id=sub.workspace_id,
        plan_id=sub.plan_id,
        status=sub.status,
        start_date=sub.start_date,
        current_period_end=sub.current_period_end,
        stripe_customer_id=sub.stripe_customer_id,
        stripe_subscription_id=sub.stripe_subscription_id,
        billing_cycle=billing_cycle,
        cancel_at_period_end=cancel_at_period_end,
        current_price_brl=current_price_brl,
        currency=currency,
        next_plan_name=sub.next_plan.name if sub.next_plan else None,
        next_plan_display_name=sub.next_plan.display_name if sub.next_plan else None,
        next_billing_cycle=(
            sub.next_billing_cycle if sub.next_billing_cycle in {"monthly", "annual"} else None
        ),
    )


async def _expire_subscription_if_needed(db: AsyncSession, sub: Subscription) -> bool:
    """Expire local access when the current period has ended."""
    if sub.status != "active" or not sub.current_period_end:
        return False

    now = datetime.now(timezone.utc)
    if now < sub.current_period_end:
        return False

    # Fallback safety in case webhook arrives late.
    if sub.next_plan_id and sub.stripe_customer_id and sub.stripe_subscription_id:
        try:
            await apply_scheduled_plan_change(
                db,
                workspace_id=sub.workspace_id,
                stripe_subscription_id=sub.stripe_subscription_id,
                stripe_customer_id=sub.stripe_customer_id,
                trigger_event_id=None,
            )
            await db.refresh(sub)
            if sub.status == "active":
                return False
        except Exception as e:
            logger.warning(
                "Failed applying scheduled plan change by period-end fallback: %s",
                e,
            )

    sub.status = "canceled"
    sub.next_plan_id = None
    sub.next_billing_cycle = None
    await db.commit()
    await db.refresh(sub)
    logger.info(
        "Subscription expired by period end: workspace=%s stripe_sub=%s",
        sub.workspace_id,
        sub.stripe_subscription_id,
    )
    return True


# Public helper


async def get_subscription_for_workspace(
    db: AsyncSession,
    workspace_id: str,
) -> Subscription | None:
    return await _get_subscription(db, workspace_id)


# List plans


async def list_plans(db: AsyncSession) -> list[PlanRead]:
    result = await db.execute(select(Plan).order_by(Plan.price_brl.asc()))
    plans = result.scalars().all()
    return [PlanRead.model_validate(p) for p in plans]


# Activate plan (webhook/dev)


async def activate_plan(
    db: AsyncSession,
    workspace_id: str,
    plan_name: str,
    *,
    billing_cycle: str = "monthly",
    stripe_customer_id: str | None = None,
    stripe_subscription_id: str | None = None,
) -> ActivatePlanResponse:
    plan = await _get_plan_by_name(db, plan_name)
    cycle = _coerce_cycle(billing_cycle)

    now = datetime.now(timezone.utc)
    period_end = now + timedelta(days=365 if cycle == "annual" else 30)

    if stripe_subscription_id:
        try:
            from app.services.stripe_service import (
                extract_subscription_snapshot,
                parse_period_end,
                retrieve_stripe_subscription,
            )

            stripe_sub = retrieve_stripe_subscription(stripe_subscription_id)
            period_end = parse_period_end(stripe_sub)
            snapshot = extract_subscription_snapshot(stripe_sub)
            snapshot_cycle = snapshot.get("billing_cycle")
            if snapshot_cycle in {"monthly", "annual"}:
                cycle = snapshot_cycle
        except Exception as e:
            logger.warning("Could not fetch Stripe period_end: %s", e)

    sub = await _get_subscription(db, workspace_id)
    old_plan_display = sub.plan.display_name if sub and sub.plan else None
    if sub:
        sub.plan_id = plan.id
        sub.status = "active"
        sub.start_date = now
        sub.current_period_end = period_end
        sub.next_plan_id = None
        sub.next_billing_cycle = None
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

    usage = await _get_usage(db, workspace_id)
    if usage:
        usage.text_used = 0
        usage.image_used = 0
        usage.video_used = 0
        usage.audio_used = 0
        usage.site_publishes_used = 0
        usage.period_start = now
        usage.period_end = period_end
    else:
        usage = UsageTracking(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            text_used=0,
            image_used=0,
            video_used=0,
            audio_used=0,
            site_publishes_used=0,
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
        subscription=_subscription_read(sub, billing_cycle=cycle),
        usage=UsageRead.model_validate(usage),
    )


# Cancel subscription


async def cancel_subscription(
    db: AsyncSession,
    workspace_id: str,
) -> CancelSubscriptionResponse:
    sub = await _get_subscription(db, workspace_id)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No subscription found for this account.",
        )

    if sub.status == "canceled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription is already canceled.",
        )

    if sub.stripe_subscription_id:
        try:
            from app.services.stripe_service import (
                parse_period_end,
                schedule_cancel_stripe_subscription,
            )

            stripe_sub = schedule_cancel_stripe_subscription(sub.stripe_subscription_id)
            sub.current_period_end = parse_period_end(stripe_sub)
            logger.info(
                "Stripe subscription %s set to cancel_at_period_end for workspace %s",
                sub.stripe_subscription_id,
                workspace_id,
            )
        except Exception as e:
            logger.error("Failed to schedule Stripe cancellation: %s", e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not schedule cancellation with Stripe.",
            )

    sub.next_plan_id = None
    sub.next_billing_cycle = None

    owner_id = await notification_service.workspace_owner_id(db, workspace_id)

    await db.commit()
    await db.refresh(sub)

    if owner_id:
        await notification_service.create_user_notification(
            db,
            user_id=owner_id,
            kind="plan_canceled",
            title="Cancelamento agendado",
            body=(
                "Sua assinatura foi configurada para encerrar no fim do período atual. "
                "Até essa data, o acesso permanece ativo."
            ),
        )
        await db.commit()

    return CancelSubscriptionResponse(
        message="Subscription will cancel at period end. Access remains active until then.",
        subscription=_subscription_read(sub),
    )


async def finalize_subscription_cancellation(
    db: AsyncSession,
    workspace_id: str,
) -> None:
    """Finalize local cancellation once Stripe ends the subscription."""
    sub = await _get_subscription(db, workspace_id)
    if not sub or sub.status == "canceled":
        return

    sub.status = "canceled"
    sub.next_plan_id = None
    sub.next_billing_cycle = None
    await db.commit()
    await db.refresh(sub)

    owner_id = await notification_service.workspace_owner_id(db, workspace_id)
    if owner_id:
        await notification_service.create_user_notification(
            db,
            user_id=owner_id,
            kind="plan_canceled",
            title="Assinatura encerrada",
            body="Seu período terminou e a assinatura foi encerrada.",
        )
        await db.commit()


# Change plan


async def change_plan(
    db: AsyncSession,
    workspace_id: str,
    plan_name: str,
    billing_cycle: str,
    user_email: str,
) -> ChangePlanResponse:
    """Request an upgrade/downgrade according to Stripe-safe business rules."""
    sub = await _get_subscription(db, workspace_id)
    if not sub or sub.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active subscription to change. Activate a plan first.",
        )
    if not sub.plan:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Current subscription plan not found.",
        )

    target_plan = await _get_plan_by_name(db, plan_name)
    target_cycle = _coerce_cycle(billing_cycle)

    current_cycle: Literal["monthly", "annual"] = "monthly"
    if sub.stripe_subscription_id:
        try:
            from app.services.stripe_service import (
                extract_subscription_snapshot,
                retrieve_stripe_subscription,
            )

            stripe_sub = retrieve_stripe_subscription(sub.stripe_subscription_id)
            snapshot = extract_subscription_snapshot(stripe_sub)
            snapshot_cycle = snapshot.get("billing_cycle")
            if snapshot_cycle in {"monthly", "annual"}:
                current_cycle = snapshot_cycle
        except Exception as e:
            logger.warning("Could not resolve current billing cycle from Stripe: %s", e)

    current_plan = sub.plan
    if current_plan.name == target_plan.name and current_cycle == target_cycle:
        if sub.next_plan_id or sub.next_billing_cycle:
            sub.next_plan_id = None
            sub.next_billing_cycle = None
            await db.commit()
            return ChangePlanResponse(
                action="no_change",
                message="Scheduled change cleared. Current subscription remains unchanged.",
                target_plan_name=current_plan.name,
                target_billing_cycle=current_cycle,
            )
        return ChangePlanResponse(
            action="no_change",
            message="You are already on this plan and billing cycle.",
            target_plan_name=current_plan.name,
            target_billing_cycle=current_cycle,
        )

    current_rank = _plan_rank(current_plan.name)
    target_rank = _plan_rank(target_plan.name)
    is_monthly_to_annual = current_cycle == "monthly" and target_cycle == "annual"

    if current_cycle == "annual" and target_cycle == "monthly":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Seu plano atual e anual. Aguarde o fim do periodo anual e cancele "
                "a assinatura para depois escolher um plano mensal."
            ),
        )

    # Upgrade and monthly->annual change: redirect to checkout and switch
    # immediately after successful payment (no proration).
    if target_rank > current_rank or is_monthly_to_annual:
        if not sub.stripe_customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Stripe customer not found. Subscribe again from pricing page.",
            )
        try:
            from app.services import stripe_service

            session = stripe_service.create_checkout_session(
                plan_name=target_plan.name,
                billing_cycle=target_cycle,
                workspace_id=workspace_id,
                user_email=user_email,
                customer_id=sub.stripe_customer_id,
                change_mode="upgrade",
                previous_subscription_id=sub.stripe_subscription_id,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error("Failed creating upgrade checkout session: %s", e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not create upgrade checkout session.",
            )

        return ChangePlanResponse(
            action="upgrade_checkout_required",
            message=(
                "Checkout criado. Apos a confirmacao do pagamento, a assinatura "
                "antiga e agendada para cancelamento e o novo plano inicia "
                "imediatamente (sem prorata)."
            ),
            checkout_url=session.url,
            checkout_session_id=session.id,
            target_plan_name=target_plan.name,
            target_billing_cycle=target_cycle,
        )

    # Downgrade or lateral move: apply only at end of cycle.
    sub.next_plan_id = target_plan.id
    sub.next_billing_cycle = target_cycle
    await db.commit()
    await db.refresh(sub)

    return ChangePlanResponse(
        action="downgrade_scheduled",
        message=(
            "Plan change scheduled for the next billing cycle. "
            "Current access remains active until period end."
        ),
        target_plan_name=target_plan.name,
        target_billing_cycle=target_cycle,
        effective_on=(sub.current_period_end.isoformat() if sub.current_period_end else None),
    )


async def apply_scheduled_plan_change(
    db: AsyncSession,
    workspace_id: str,
    *,
    stripe_subscription_id: str | None,
    stripe_customer_id: str | None,
    trigger_event_id: str | None,
) -> ActivatePlanResponse | None:
    """Apply pending next_plan at the end of the current cycle."""
    sub = await _get_subscription(db, workspace_id)
    if not sub or not sub.next_plan_id:
        return None

    target_plan = sub.next_plan
    if not target_plan:
        result = await db.execute(select(Plan).where(Plan.id == sub.next_plan_id))
        target_plan = result.scalars().first()
    if not target_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled next plan was not found.",
        )

    current_sub_id = stripe_subscription_id or sub.stripe_subscription_id
    customer_id = stripe_customer_id or sub.stripe_customer_id
    if not current_sub_id or not customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe references missing to apply scheduled plan change.",
        )

    target_cycle = _coerce_cycle(sub.next_billing_cycle)

    from app.services import stripe_service

    # Requested flow: cancel old sub, create new one without proration.
    try:
        stripe_service.cancel_stripe_subscription(current_sub_id)
    except Exception as e:
        logger.error("Failed to cancel previous Stripe subscription: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not cancel previous Stripe subscription.",
        )

    idempotency_key = None
    if trigger_event_id:
        idempotency_key = f"apply-next-plan-{workspace_id}-{target_plan.name}-{trigger_event_id}"

    try:
        new_sub = stripe_service.create_stripe_subscription(
            customer_id=customer_id,
            plan_name=target_plan.name,
            billing_cycle=target_cycle,
            workspace_id=workspace_id,
            idempotency_key=idempotency_key,
        )
    except Exception as e:
        logger.error("Failed to create new Stripe subscription for scheduled change: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not create the new Stripe subscription.",
        )

    return await activate_plan(
        db,
        workspace_id=workspace_id,
        plan_name=target_plan.name,
        billing_cycle=target_cycle,
        stripe_customer_id=customer_id,
        stripe_subscription_id=new_sub.id,
    )


# Get billing status


async def get_billing_status(db: AsyncSession, workspace_id: str) -> BillingStatusResponse:
    sub = await _get_subscription(db, workspace_id)
    usage = await _get_usage(db, workspace_id)

    if not sub:
        return BillingStatusResponse(subscription=None, usage=None, is_active=False)

    await _expire_subscription_if_needed(db, sub)
    sub = await _get_subscription(db, workspace_id)
    if not sub:
        return BillingStatusResponse(subscription=None, usage=None, is_active=False)

    plan = sub.plan
    if not plan:
        result = await db.execute(select(Plan).where(Plan.id == sub.plan_id))
        plan = result.scalars().first()
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Subscription plan not found.",
            )

    billing_cycle: Literal["monthly", "annual"] | None = None
    cancel_at_period_end = False
    current_price_brl = None
    currency = None
    if sub.stripe_subscription_id:
        try:
            from app.services.stripe_service import (
                extract_subscription_snapshot,
                retrieve_stripe_subscription,
            )

            stripe_sub = retrieve_stripe_subscription(sub.stripe_subscription_id)
            snapshot = extract_subscription_snapshot(stripe_sub)
            snapshot_cycle = snapshot.get("billing_cycle")
            if snapshot_cycle in {"monthly", "annual"}:
                billing_cycle = snapshot_cycle
            cancel_at_period_end = bool(snapshot.get("cancel_at_period_end"))
            current_price_brl = snapshot.get("unit_amount_brl")
            currency = snapshot.get("currency")
        except Exception as e:
            logger.warning("Could not fetch Stripe snapshot for billing status: %s", e)

    sub_read = SubscriptionWithPlan(
        **_subscription_read(
            sub,
            billing_cycle=billing_cycle,
            cancel_at_period_end=cancel_at_period_end,
            current_price_brl=current_price_brl,
            currency=currency,
        ).model_dump(),
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
            audio_remaining=_remaining(usage.audio_used, plan.audio_limit),
            site_publishes_remaining=_remaining(usage.site_publishes_used, plan.site_publish_limit),
        )

    return BillingStatusResponse(
        subscription=sub_read,
        usage=usage_with_limits,
        is_active=sub.status == "active",
    )


# Get usage only


async def get_usage(db: AsyncSession, workspace_id: str) -> UsageWithLimits:
    sub = await _get_subscription(db, workspace_id)
    if not sub or sub.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No active subscription.",
        )

    await _expire_subscription_if_needed(db, sub)
    sub = await _get_subscription(db, workspace_id)
    if not sub or sub.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Subscription period ended. Please choose a plan.",
        )

    usage = await _get_usage(db, workspace_id)
    if not usage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usage tracker not found.",
        )

    plan = sub.plan
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Subscription plan not found.",
        )

    usage_read = UsageRead.model_validate(usage)
    return UsageWithLimits(
        usage=usage_read,
        limits=PlanRead.model_validate(plan),
        text_remaining=_remaining(usage.text_used, plan.text_limit),
        image_remaining=_remaining(usage.image_used, plan.image_limit),
        video_remaining=_remaining(usage.video_used, plan.video_limit),
        audio_remaining=_remaining(usage.audio_used, plan.audio_limit),
        site_publishes_remaining=_remaining(usage.site_publishes_used, plan.site_publish_limit),
    )


# Get current subscription


async def get_current_subscription(
    db: AsyncSession,
    workspace_id: str,
) -> CurrentSubscriptionResponse:
    sub = await _get_subscription(db, workspace_id)

    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma assinatura encontrada para esta conta.",
        )

    await _expire_subscription_if_needed(db, sub)
    sub = await _get_subscription(db, workspace_id)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma assinatura encontrada para esta conta.",
        )

    plan = sub.plan
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Plano da assinatura não encontrado.",
        )

    usage = await _get_usage(db, workspace_id)
    usage_read = UsageRead.model_validate(usage) if usage else None

    billing_cycle: Literal["monthly", "annual"] | None = None
    cancel_at_period_end = False
    current_price_brl = float(plan.price_brl)
    currency = "BRL"
    if sub.stripe_subscription_id:
        try:
            from app.services.stripe_service import (
                extract_subscription_snapshot,
                retrieve_stripe_subscription,
            )

            stripe_sub = retrieve_stripe_subscription(sub.stripe_subscription_id)
            snapshot = extract_subscription_snapshot(stripe_sub)
            snapshot_cycle = snapshot.get("billing_cycle")
            if snapshot_cycle in {"monthly", "annual"}:
                billing_cycle = snapshot_cycle
            cancel_at_period_end = bool(snapshot.get("cancel_at_period_end"))
            if snapshot.get("unit_amount_brl") is not None:
                current_price_brl = float(snapshot["unit_amount_brl"])
            currency = snapshot.get("currency") or currency
        except Exception as e:
            logger.warning("Could not fetch Stripe snapshot for current subscription: %s", e)

    return CurrentSubscriptionResponse(
        plan_name=plan.name,
        display_name=plan.display_name,
        price=current_price_brl,
        billing_cycle=billing_cycle,
        cancel_at_period_end=cancel_at_period_end,
        currency=currency,
        next_plan_name=sub.next_plan.name if sub.next_plan else None,
        next_plan_display_name=sub.next_plan.display_name if sub.next_plan else None,
        next_billing_cycle=(
            sub.next_billing_cycle if sub.next_billing_cycle in {"monthly", "annual"} else None
        ),
        status=sub.status,
        current_period_end=(sub.current_period_end.isoformat() if sub.current_period_end else None),
        limits=PlanRead.model_validate(plan),
        usage=usage_read,
    )
