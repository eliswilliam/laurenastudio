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
"""
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services import billing_service, stripe_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook", tags=["Webhooks"])


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
    logger.info("Stripe webhook received: %s (id=%s)", event_type, ed.get("id"))

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

        else:
            logger.debug("Unhandled Stripe event type: %s", event_type)

    except Exception as e:
        logger.error("Error processing Stripe event %s: %s", event_type, e, exc_info=True)
        # Return 200 anyway so Stripe doesn't keep retrying on business-logic errors.
        # Only signature failures should return 4xx.

    return {"received": True}


# ── Event Handlers ───────────────────────────────────────────────────────────


async def _handle_checkout_completed(event: dict, db: AsyncSession) -> None:
    """
    checkout.session.completed
    Fired when the customer completes payment (card: immediate, boleto: async).
    For card payments, payment_status = 'paid' → activate now.
    For boleto, payment_status = 'unpaid' → wait for async_payment_succeeded.
    """
    session = event["data"]["object"]
    payment_status = session.get("payment_status")
    metadata = session.get("metadata", {})
    workspace_id = metadata.get("workspace_id")
    plan_name = metadata.get("plan_name")
    billing_cycle = metadata.get("billing_cycle") or "monthly"
    customer_id = session.get("customer")
    stripe_subscription_id = session.get("subscription")

    if not workspace_id or not plan_name:
        logger.warning(
            "checkout.session.completed missing metadata: workspace_id=%s plan_name=%s",
            workspace_id, plan_name,
        )
        return

    if payment_status == "paid":
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
    metadata = session.get("metadata", {})
    workspace_id = metadata.get("workspace_id")
    plan_name = metadata.get("plan_name")
    billing_cycle = metadata.get("billing_cycle") or "monthly"
    customer_id = session.get("customer")
    stripe_subscription_id = session.get("subscription")

    if not workspace_id or not plan_name:
        logger.warning(
            "async_payment_succeeded missing metadata: workspace_id=%s plan_name=%s",
            workspace_id, plan_name,
        )
        return

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
    metadata = subscription.get("metadata", {})
    workspace_id = metadata.get("workspace_id")

    if not workspace_id:
        logger.warning("subscription.deleted missing workspace_id in metadata")
        return

    logger.info("Stripe subscription deleted for workspace=%s", workspace_id)
    await billing_service.cancel_subscription(db, workspace_id)
