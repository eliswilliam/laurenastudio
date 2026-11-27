"""
routes/webhook.py
Stripe webhook handler — receives events from Stripe and updates subscriptions.

Events handled:
  - checkout.session.completed      → Activate subscription
  - checkout.session.expired        → Log expiration
  - checkout.session.async_payment_succeeded → Activate (boleto confirmed)
  - checkout.session.async_payment_failed   → Log failure
  - customer.subscription.deleted   → Cancel subscription locally

NO JWT auth — Stripe authenticates via webhook signature (stripe-signature header).

SECURITY: La déduplication des événements Stripe est persistée dans Redis (db=2)
avec un TTL de 24h. Cela garantit qu'un redémarrage du serveur ne réinitialise
pas la fenêtre de déduplication, empêchant les attaques par rejeu.
"""
import logging
from datetime import datetime, timezone

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.subscription import Subscription
from app.services import billing_service, stripe_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook", tags=["Webhooks"])

_REDIS_DB_DEDUP = 2          # Isolé de ARQ (db=0) et OAuth (db=1)
_DEDUP_PREFIX = "stripe:dedup:"
_DEDUP_TTL = 24 * 60 * 60   # 24 heures


async def _redis_dedup() -> aioredis.Redis:
    """Client Redis persistant pour la déduplication des webhooks Stripe."""
    url = settings.REDIS_URL.rstrip("/")
    if "/" in url.split("://", 1)[-1]:
        base = url.rsplit("/", 1)[0]
    else:
        base = url
    return aioredis.from_url(f"{base}/{_REDIS_DB_DEDUP}", decode_responses=True)


async def _is_duplicate_event(event_id: str | None) -> bool:
    """
    Vérifie si l'événement Stripe a déjà été traité (Redis, TTL 24h).
    Retourne True si duplicate, False sinon.
    Utilise SET NX (atomic) pour éviter les race conditions.
    """
    if not event_id:
        return False

    client = await _redis_dedup()
    try:
        key = f"{_DEDUP_PREFIX}{event_id}"
        # SET key "1" NX EX 86400 — atomique, retourne True si la clé a été créée
        result = await client.set(key, "1", nx=True, ex=_DEDUP_TTL)
        # result = True → nouvelle clé créée → pas de duplicate
        # result = None → clé existait déjà → duplicate
        return result is None
    finally:
        await client.aclose()


@router.post(
    "/stripe",
    status_code=200,
    summary="Stripe webhook receiver",
    description=(
        "Receives Stripe webhook events. Verifies the signature, "
        "then processes checkout completions, async payments, and subscription deletions."
    ),
)
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(alias="stripe-signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    Must read the raw body (not JSON-parsed) for signature verification.
    Mirrors the tutorial webhook route: verify → switch on event type → act.
    """
    # 1. Read raw body for signature verification
    payload = await request.body()

    # 2. Verify signature
    try:
        event = stripe_service.verify_webhook_signature(payload, stripe_signature)
    except Exception as e:
        logger.warning("Stripe webhook signature verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature.",
        )

    # StripeObject is not dict-like (.get raises) — normalize to plain dicts.
    ed = stripe_service.stripe_object_to_dict(event)
    event_type = ed["type"]
    event_id = str(ed.get("id") or "")

    if await _is_duplicate_event(event_id):
        logger.info("Stripe duplicate webhook ignored: type=%s id=%s", event_type, event_id)
        return {"received": True, "duplicate": True}

    logger.info("Stripe webhook received: type=%s id=%s", event_type, event_id)

    # 3. Dispatch by event type
    try:
        if event_type == "checkout.session.completed":
            await _handle_checkout_completed(ed, db)

        elif event_type == "checkout.session.expired":
            _handle_checkout_expired(ed)

        elif event_type == "checkout.session.async_payment_succeeded":
            await _handle_async_payment_succeeded(ed, db)

        elif event_type == "checkout.session.async_payment_failed":
            _handle_async_payment_failed(ed)

        elif event_type == "customer.subscription.deleted":
            await _handle_subscription_deleted(ed, db)

        elif event_type == "customer.subscription.updated":
            await _handle_subscription_updated(ed, db)

        else:
            logger.debug("Unhandled Stripe event type: %s", event_type)

    except Exception as e:
        logger.error(
            "Stripe webhook processing failed: type=%s id=%s error=%s",
            event_type,
            event_id,
            e,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook processing failed. Retry later.",
        )

    return {"received": True}


# ── Event Handlers ───────────────────────────────────────────────────────────


def _schedule_old_subscription_if_upgrade(
    *,
    metadata: dict,
    new_subscription_id: str | None,
    workspace_id: str,
) -> None:
    change_mode = metadata.get("change_mode")
    previous_subscription_id = metadata.get("previous_subscription_id")
    if (
        change_mode != "upgrade"
        or not previous_subscription_id
        or not new_subscription_id
        or previous_subscription_id == new_subscription_id
    ):
        return

    try:
        stripe_service.schedule_cancel_stripe_subscription(previous_subscription_id)
        logger.info(
            "Upgrade checkout paid: old Stripe subscription scheduled for cancellation "
            "workspace=%s old=%s new=%s",
            workspace_id,
            previous_subscription_id,
            new_subscription_id,
        )
    except Exception as e:
        logger.warning(
            "Failed to schedule old Stripe subscription cancellation old=%s: %s",
            previous_subscription_id,
            e,
        )


async def _resolve_checkout_context(
    session: dict,
    db: AsyncSession,
) -> tuple[str | None, str | None, str, str | None, str | None, dict]:
    """
    Resolve checkout context even when event metadata is partially missing.

    Fallback order:
      1) event payload metadata/client_reference_id
      2) retrieve full Checkout Session from Stripe by session id
      3) map customer -> local workspace
      4) resolve plan/cycle from Stripe subscription price id
    """
    metadata = dict(session.get("metadata") or {})
    workspace_id = metadata.get("workspace_id") or session.get("client_reference_id")
    plan_name = metadata.get("plan_name")
    billing_cycle = metadata.get("billing_cycle") or "monthly"
    customer_id = session.get("customer")
    stripe_subscription_id = session.get("subscription")

    session_id = session.get("id")
    if session_id and (not workspace_id or not plan_name or not stripe_subscription_id):
        try:
            full_session = stripe_service.retrieve_checkout_session(session_id)
            full_sd = stripe_service.stripe_object_to_dict(full_session)
            full_metadata = dict(full_sd.get("metadata") or {})
            if full_metadata:
                metadata = full_metadata
            workspace_id = (
                workspace_id
                or full_metadata.get("workspace_id")
                or full_sd.get("client_reference_id")
            )
            plan_name = plan_name or full_metadata.get("plan_name")
            billing_cycle = full_metadata.get("billing_cycle") or billing_cycle
            customer_id = customer_id or full_sd.get("customer")
            stripe_subscription_id = stripe_subscription_id or full_sd.get("subscription")
        except Exception as e:
            logger.warning(
                "Could not retrieve full checkout session id=%s for fallback context: %s",
                session_id,
                e,
            )

    if not workspace_id and customer_id:
        try:
            local_sub_result = await db.execute(
                select(Subscription)
                .where(Subscription.stripe_customer_id == customer_id)
                .order_by(Subscription.created_at.desc())
            )
            local_sub = local_sub_result.scalars().first()
            if local_sub:
                workspace_id = local_sub.workspace_id
        except Exception as e:
            logger.warning(
                "Could not resolve workspace by stripe customer id=%s: %s",
                customer_id,
                e,
            )

    if stripe_subscription_id and not plan_name:
        try:
            resolved_plan, resolved_cycle, _snapshot = (
                stripe_service.resolve_plan_and_cycle_from_subscription(
                    stripe_subscription_id,
                    fallback_plan_name=None,
                    fallback_cycle=billing_cycle if billing_cycle in {"monthly", "annual"} else "monthly",
                )
            )
            plan_name = resolved_plan
            billing_cycle = resolved_cycle
        except Exception as e:
            logger.warning(
                "Could not resolve plan/cycle from Stripe subscription=%s in metadata fallback: %s",
                stripe_subscription_id,
                e,
            )

    if billing_cycle not in {"monthly", "annual"}:
        billing_cycle = "monthly"

    return workspace_id, plan_name, billing_cycle, customer_id, stripe_subscription_id, metadata


async def _handle_checkout_completed(event: dict, db: AsyncSession) -> None:
    """
    checkout.session.completed
    Fired when the customer completes payment (card: immediate, boleto: async).
    For card payments, payment_status = 'paid' → activate now.
    For boleto, payment_status = 'unpaid' → wait for async_payment_succeeded.
    """
    session = event["data"]["object"]
    payment_status = session.get("payment_status")
    (
        workspace_id,
        plan_name,
        billing_cycle,
        customer_id,
        stripe_subscription_id,
        metadata,
    ) = await _resolve_checkout_context(session, db)

    if not workspace_id or not plan_name:
        logger.warning(
            "checkout.session.completed missing context after fallback: session_id=%s workspace_id=%s plan_name=%s client_reference_id=%s",
            session.get("id"),
            workspace_id,
            plan_name,
            session.get("client_reference_id"),
        )
        return

    if payment_status == "paid":
        _schedule_old_subscription_if_upgrade(
            metadata=metadata,
            new_subscription_id=stripe_subscription_id,
            workspace_id=workspace_id,
        )

        resolved_plan = plan_name
        resolved_cycle = billing_cycle
        if stripe_subscription_id:
            try:
                resolved_plan, resolved_cycle, _snapshot = (
                    stripe_service.resolve_plan_and_cycle_from_subscription(
                        stripe_subscription_id,
                        fallback_plan_name=plan_name,
                        fallback_cycle=billing_cycle,
                    )
                )
            except Exception as e:
                logger.warning(
                    "Could not resolve plan/cycle from Stripe subscription %s: %s",
                    stripe_subscription_id,
                    e,
                )

        # Card payment — activate immediately
        logger.info(
            "Activating subscription: workspace=%s plan=%s cycle=%s stripe_sub=%s",
            workspace_id, resolved_plan, resolved_cycle, stripe_subscription_id,
        )
        await billing_service.activate_plan(
            db,
            workspace_id=workspace_id,
            plan_name=resolved_plan,
            billing_cycle=resolved_cycle,
            stripe_customer_id=customer_id,
            stripe_subscription_id=stripe_subscription_id,
        )
    else:
        # Boleto or other async payment — wait for confirmation
        logger.info(
            "checkout.session.completed with payment_status=%s for workspace=%s. "
            "Waiting for async payment confirmation.",
            payment_status, workspace_id,
        )


async def _handle_async_payment_succeeded(event: dict, db: AsyncSession) -> None:
    """
    checkout.session.async_payment_succeeded
    Fired when a boleto payment is confirmed. Now we can activate.
    """
    session = event["data"]["object"]
    (
        workspace_id,
        plan_name,
        billing_cycle,
        customer_id,
        stripe_subscription_id,
        metadata,
    ) = await _resolve_checkout_context(session, db)

    if not workspace_id or not plan_name:
        logger.warning(
            "async_payment_succeeded missing context after fallback: session_id=%s workspace_id=%s plan_name=%s client_reference_id=%s",
            session.get("id"),
            workspace_id,
            plan_name,
            session.get("client_reference_id"),
        )
        return

    resolved_plan = plan_name
    resolved_cycle = billing_cycle
    _schedule_old_subscription_if_upgrade(
        metadata=metadata,
        new_subscription_id=stripe_subscription_id,
        workspace_id=workspace_id,
    )

    if stripe_subscription_id:
        try:
            resolved_plan, resolved_cycle, _snapshot = (
                stripe_service.resolve_plan_and_cycle_from_subscription(
                    stripe_subscription_id,
                    fallback_plan_name=plan_name,
                    fallback_cycle=billing_cycle,
                )
            )
        except Exception as e:
            logger.warning(
                "Could not resolve async plan/cycle from Stripe subscription %s: %s",
                stripe_subscription_id,
                e,
            )

    logger.info(
        "Boleto payment confirmed: workspace=%s plan=%s cycle=%s",
        workspace_id,
        resolved_plan,
        resolved_cycle,
    )
    await billing_service.activate_plan(
        db,
        workspace_id=workspace_id,
        plan_name=resolved_plan,
        billing_cycle=resolved_cycle,
        stripe_customer_id=customer_id,
        stripe_subscription_id=stripe_subscription_id,
    )


def _handle_checkout_expired(event: dict) -> None:
    """
    checkout.session.expired
    The customer never completed payment. Log it for analytics.
    """
    session = event["data"]["object"]
    metadata = session.get("metadata", {})
    workspace_id = metadata.get("workspace_id")
    logger.info("Checkout expired for workspace=%s", workspace_id)


def _handle_async_payment_failed(event: dict) -> None:
    """
    checkout.session.async_payment_failed
    Boleto not paid within deadline. Log it.
    """
    session = event["data"]["object"]
    metadata = session.get("metadata", {})
    workspace_id = metadata.get("workspace_id")
    logger.info("Async payment failed for workspace=%s", workspace_id)


async def _handle_subscription_deleted(event: dict, db: AsyncSession) -> None:
    """
    customer.subscription.deleted
    Stripe automatically fires this when a subscription is canceled
    or the payment fails after all retry attempts.
    """
    subscription = event["data"]["object"]
    stripe_subscription_id = subscription.get("id")

    if not stripe_subscription_id:
        logger.warning("subscription.deleted missing subscription id")
        return

    # Only cancel local access if the deleted Stripe subscription is the one
    # currently linked to the workspace. This avoids stale events from an old
    # subscription canceling a newly switched plan.
    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    local_sub = result.scalars().first()
    if not local_sub:
        logger.info(
            "Ignoring subscription.deleted for stale/non-linked Stripe sub id=%s",
            stripe_subscription_id,
        )
        return

    logger.info(
        "Stripe subscription deleted for workspace=%s stripe_sub=%s",
        local_sub.workspace_id,
        stripe_subscription_id,
    )
    await billing_service.finalize_subscription_cancellation(db, local_sub.workspace_id)


async def _handle_subscription_updated(event: dict, db: AsyncSession) -> None:
    """
    customer.subscription.updated
    Used to:
      1) apply scheduled next_plan at renewal,
      2) sync period_end / cancel_at_period_end metadata.
    """
    subscription = event["data"]["object"]
    stripe_subscription_id = subscription.get("id")
    if not stripe_subscription_id:
        return

    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    local_sub = result.scalars().first()
    if not local_sub:
        return

    current_period_end_ts = subscription.get("current_period_end")
    previous_attrs = event.get("data", {}).get("previous_attributes") or {}
    previous_period_end_ts = previous_attrs.get("current_period_end")
    period_rolled = (
        isinstance(previous_period_end_ts, int)
        and isinstance(current_period_end_ts, int)
        and current_period_end_ts > previous_period_end_ts
    )

    if local_sub.next_plan_id and period_rolled:
        try:
            await billing_service.apply_scheduled_plan_change(
                db,
                workspace_id=local_sub.workspace_id,
                stripe_subscription_id=stripe_subscription_id,
                stripe_customer_id=subscription.get("customer"),
                trigger_event_id=event.get("id"),
            )
            logger.info(
                "Applied scheduled next_plan on renewal: workspace=%s stripe_sub=%s",
                local_sub.workspace_id,
                stripe_subscription_id,
            )
            return
        except Exception as e:
            logger.error(
                "Failed applying scheduled next_plan on renewal workspace=%s: %s",
                local_sub.workspace_id,
                e,
            )

    updated = False
    if isinstance(current_period_end_ts, int):
        local_sub.current_period_end = datetime.fromtimestamp(
            current_period_end_ts,
            tz=timezone.utc,
        )
        updated = True

    cancel_at_period_end = bool(subscription.get("cancel_at_period_end"))
    if updated:
        await db.commit()
    if not cancel_at_period_end:
        return

    logger.info(
        "Synced cancel_at_period_end for workspace=%s subscription=%s period_end=%s",
        local_sub.workspace_id,
        stripe_subscription_id,
        local_sub.current_period_end,
    )
