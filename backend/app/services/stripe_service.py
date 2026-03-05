"""
services/stripe_service.py
Stripe integration — checkout sessions, webhook handling, customer portal.

Translates the Next.js tutorial patterns (create-checkout + webhook) into
FastAPI-compatible async code using the official stripe-python SDK.
"""
import logging
import stripe
from datetime import datetime, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Initialize Stripe SDK ────────────────────────────────────────────────────
stripe.api_key = settings.STRIPE_SECRET_KEY

# ── Plan name → Stripe Price ID mapping ──────────────────────────────────────
PLAN_PRICE_MAP: dict[str, str] = {
    "starter": settings.STRIPE_PRICE_ID_STARTER,
    "pro": settings.STRIPE_PRICE_ID_PRO,
    "business": settings.STRIPE_PRICE_ID_BUSINESS,
}


def get_price_id_for_plan(plan_name: str) -> str:
    """Resolve a plan name to its Stripe Price ID."""
    price_id = PLAN_PRICE_MAP.get(plan_name.lower().strip())
    if not price_id:
        raise ValueError(
            f"No Stripe Price ID configured for plan '{plan_name}'. "
            f"Valid plans: {list(PLAN_PRICE_MAP.keys())}"
        )
    return price_id


# ── Create Checkout Session ──────────────────────────────────────────────────

def create_checkout_session(
    *,
    plan_name: str,
    workspace_id: str,
    user_email: str,
    success_url: str | None = None,
    cancel_url: str | None = None,
) -> stripe.checkout.Session:
    """
    Create a Stripe Checkout Session in **subscription** mode.
    Metadata carries workspace_id + plan_name so the webhook can activate
    the correct workspace subscription.

    Mirrors the tutorial's create-checkout route but adapted for SaaS
    multi-tenant: workspace_id is passed as metadata, and mode is always
    'subscription'.
    """
    price_id = get_price_id_for_plan(plan_name)

    frontend = settings.FRONTEND_URL
    _success = success_url or f"{frontend}/checkout/sucesso?session_id={{CHECKOUT_SESSION_ID}}"
    _cancel = cancel_url or f"{frontend}/checkout/sucesso?canceled=true"

    session = stripe.checkout.Session.create(
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        payment_method_types=["card", "boleto"],
        customer_email=user_email,
        success_url=_success,
        cancel_url=_cancel,
        metadata={
            "workspace_id": workspace_id,
            "plan_name": plan_name,
        },
        subscription_data={
            "metadata": {
                "workspace_id": workspace_id,
                "plan_name": plan_name,
            }
        },
    )
    return session


# ── Create Customer Portal Session ───────────────────────────────────────────

def create_customer_portal_session(
    customer_id: str,
    return_url: str | None = None,
) -> stripe.billing_portal.Session:
    """
    Create a Stripe Customer Portal session so users can manage their
    subscription (upgrade, downgrade, cancel, update payment method).
    """
    _return = return_url or f"{settings.FRONTEND_URL}/configuracoes"
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=_return,
    )
    return session


# ── Cancel Subscription on Stripe ────────────────────────────────────────────

def cancel_stripe_subscription(stripe_subscription_id: str) -> stripe.Subscription:
    """Cancel a Stripe subscription immediately."""
    return stripe.Subscription.cancel(stripe_subscription_id)


# ── Webhook signature verification ──────────────────────────────────────────

def verify_webhook_signature(payload: bytes, sig_header: str) -> stripe.Event:
    """
    Verify the Stripe webhook signature and parse the event.
    Mirrors the tutorial's webhook route verification.
    """
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
    )


# ── Retrieve Checkout Session (direct API verification) ─────────────────────

def retrieve_checkout_session(session_id: str) -> stripe.checkout.Session:
    """Retrieve a Stripe Checkout Session by ID to verify payment status directly."""
    return stripe.checkout.Session.retrieve(session_id)


# ── Retrieve subscription details from Stripe ───────────────────────────────

def retrieve_stripe_subscription(subscription_id: str) -> stripe.Subscription:
    """Fetch full subscription object from Stripe."""
    return stripe.Subscription.retrieve(subscription_id, expand=["items.data.price"])


# ── Retrieve payment intent (for boleto) ────────────────────────────────────

def retrieve_payment_intent(payment_intent_id: str) -> stripe.PaymentIntent:
    """Fetch payment intent — used to get boleto voucher URL."""
    return stripe.PaymentIntent.retrieve(payment_intent_id)


# ── Parse period end from Stripe subscription ───────────────────────────────

def parse_period_end(stripe_sub: stripe.Subscription) -> datetime:
    """Convert Stripe's current_period_end (Unix timestamp) to datetime."""
    return datetime.fromtimestamp(
        stripe_sub.current_period_end, tz=timezone.utc
    )
