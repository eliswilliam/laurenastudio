"""
services/stripe_service.py
Stripe integration — checkout sessions, webhook handling, customer portal.

Translates the Next.js tutorial patterns (create-checkout + webhook) into
FastAPI-compatible async code using the official stripe-python SDK.
"""
import hashlib
import logging
import stripe
from datetime import datetime, timezone
from typing import Literal

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Initialize Stripe SDK ────────────────────────────────────────────────────
stripe.api_key = settings.STRIPE_SECRET_KEY


def stripe_object_to_dict(obj: object) -> dict:
    """
    Convert Stripe SDK objects (StripeObject) to plain dicts.

    StripeObject does not provide dict-like .get(); using session.get("x") raises
    AttributeError because the SDK resolves .get as a Stripe field name.
    """
    if isinstance(obj, dict):
        return obj
    to_dict = getattr(obj, "to_dict", None)
    if callable(to_dict):
        return to_dict()
    try:
        return dict(obj)
    except Exception:
        logger.warning("Could not convert Stripe object to dict: %r", type(obj))
        return {}


def _get_cycle_price_id(plan_key: str, billing_cycle: str) -> str:
    if billing_cycle == "monthly":
        cycle_map = {
            "starter": settings.STRIPE_PRICE_ID_STARTER_MONTHLY,
            "pro": settings.STRIPE_PRICE_ID_PRO_MONTHLY,
            "business": settings.STRIPE_PRICE_ID_BUSINESS_MONTHLY,
        }
    else:
        cycle_map = {
            "starter": settings.STRIPE_PRICE_ID_STARTER_ANNUAL,
            "pro": settings.STRIPE_PRICE_ID_PRO_ANNUAL,
            "business": settings.STRIPE_PRICE_ID_BUSINESS_ANNUAL,
        }
    return cycle_map.get(plan_key, "")


def map_price_id_to_plan_cycle(price_id: str | None) -> tuple[str, str] | None:
    """Map a Stripe price ID to internal plan + billing cycle."""
    if not price_id:
        return None

    price_to_plan: dict[str, tuple[str, str]] = {}
    configured = {
        settings.STRIPE_PRICE_ID_STARTER_MONTHLY: ("starter", "monthly"),
        settings.STRIPE_PRICE_ID_PRO_MONTHLY: ("pro", "monthly"),
        settings.STRIPE_PRICE_ID_BUSINESS_MONTHLY: ("business", "monthly"),
        settings.STRIPE_PRICE_ID_STARTER_ANNUAL: ("starter", "annual"),
        settings.STRIPE_PRICE_ID_PRO_ANNUAL: ("pro", "annual"),
        settings.STRIPE_PRICE_ID_BUSINESS_ANNUAL: ("business", "annual"),
    }
    for pid, plan_cycle in configured.items():
        if pid:
            price_to_plan[pid] = plan_cycle

    # Legacy IDs are assumed monthly.
    if settings.STRIPE_PRICE_ID_STARTER:
        price_to_plan[settings.STRIPE_PRICE_ID_STARTER] = ("starter", "monthly")
    if settings.STRIPE_PRICE_ID_PRO:
        price_to_plan[settings.STRIPE_PRICE_ID_PRO] = ("pro", "monthly")
    if settings.STRIPE_PRICE_ID_BUSINESS:
        price_to_plan[settings.STRIPE_PRICE_ID_BUSINESS] = ("business", "monthly")

    return price_to_plan.get(price_id)


def get_price_id_for_plan(
    plan_name: str,
    billing_cycle: Literal["monthly", "annual"] = "monthly",
) -> str:
    """Resolve a plan name + cycle to its Stripe Price ID."""
    plan_key = plan_name.lower().strip()
    if plan_key not in {"starter", "pro", "business"}:
        raise ValueError(
            f"Invalid plan '{plan_name}'. Valid plans: ['starter', 'pro', 'business']"
        )

    cycle_price_id = _get_cycle_price_id(plan_key, billing_cycle)
    if cycle_price_id:
        return cycle_price_id

    raise ValueError(
        "No Stripe Price ID configured for "
        f"plan='{plan_name}' cycle='{billing_cycle}'. "
        "Set STRIPE_PRICE_ID_<PLAN>_<MONTHLY|ANNUAL>."
    )


def extract_subscription_snapshot(stripe_sub: stripe.Subscription) -> dict:
    """Extract normalized cycle/price metadata from a Stripe subscription."""
    sd = stripe_object_to_dict(stripe_sub)
    items = (((sd.get("items") or {}).get("data")) or [])
    first_item = items[0] if items else {}
    price = first_item.get("price") or {}
    recurring = price.get("recurring") or {}

    price_id = price.get("id")
    amount_cents = price.get("unit_amount")
    currency = (price.get("currency") or "").upper() or None
    interval = recurring.get("interval")
    interval_count = recurring.get("interval_count") or 1
    cancel_at_period_end = bool(sd.get("cancel_at_period_end"))

    billing_cycle: str | None = None
    if interval == "year" and interval_count == 1:
        billing_cycle = "annual"
    elif interval == "month" and interval_count == 1:
        billing_cycle = "monthly"

    mapped = map_price_id_to_plan_cycle(price_id)
    plan_name = mapped[0] if mapped else None

    amount_brl = None
    if isinstance(amount_cents, int):
        amount_brl = amount_cents / 100

    return {
        "plan_name": plan_name,
        "billing_cycle": billing_cycle,
        "cancel_at_period_end": cancel_at_period_end,
        "price_id": price_id,
        "unit_amount_brl": amount_brl,
        "currency": currency,
    }


def resolve_plan_and_cycle_from_subscription(
    subscription_id: str,
    *,
    fallback_plan_name: str | None = None,
    fallback_cycle: Literal["monthly", "annual"] = "monthly",
) -> tuple[str, Literal["monthly", "annual"], dict]:
    """Resolve authoritative plan/cycle using Stripe subscription price metadata."""
    stripe_sub = retrieve_stripe_subscription(subscription_id)
    snapshot = extract_subscription_snapshot(stripe_sub)

    resolved_plan = snapshot.get("plan_name") or fallback_plan_name
    resolved_cycle = snapshot.get("billing_cycle") or fallback_cycle

    if not resolved_plan:
        raise ValueError("Unable to resolve plan name from Stripe subscription.")
    if resolved_cycle not in {"monthly", "annual"}:
        resolved_cycle = fallback_cycle

    return resolved_plan, resolved_cycle, snapshot


# ── Create Checkout Session ──────────────────────────────────────────────────

def create_checkout_session(
    *,
    plan_name: str,
    billing_cycle: Literal["monthly", "annual"] = "monthly",
    workspace_id: str,
    user_email: str,
    success_url: str | None = None,
    cancel_url: str | None = None,
    customer_id: str | None = None,
    change_mode: Literal["new", "upgrade"] = "new",
    previous_subscription_id: str | None = None,
) -> stripe.checkout.Session:
    """
    Create a Stripe Checkout Session in **subscription** mode.
    Metadata carries workspace_id + plan_name so the webhook can activate
    the correct workspace subscription.

    Mirrors the tutorial's create-checkout route but adapted for SaaS
    multi-tenant: workspace_id is passed as metadata, and mode is always
    'subscription'.
    """
    price_id = get_price_id_for_plan(plan_name, billing_cycle)

    frontend = settings.FRONTEND_URL
    _success = success_url or f"{frontend}/checkout/sucesso?session_id={{CHECKOUT_SESSION_ID}}"
    _cancel = cancel_url or f"{frontend}/checkout/sucesso?canceled=true"

    metadata = {
        "workspace_id": workspace_id,
        "plan_name": plan_name,
        "billing_cycle": billing_cycle,
        "change_mode": change_mode,
    }
    if previous_subscription_id:
        metadata["previous_subscription_id"] = previous_subscription_id

    session_kwargs: dict = {
        "line_items": [{"price": price_id, "quantity": 1}],
        "mode": "subscription",
        "payment_method_types": ["card", "boleto"],
        "success_url": _success,
        "cancel_url": _cancel,
        "client_reference_id": workspace_id,
        "metadata": metadata,
        "subscription_data": {
            "metadata": metadata,
        },
    }
    if customer_id:
        session_kwargs["customer"] = customer_id
    else:
        session_kwargs["customer_email"] = user_email

    idempotency_source = "|".join(
        [
            workspace_id,
            plan_name.lower().strip(),
            billing_cycle,
            change_mode,
            previous_subscription_id or "none",
        ]
    )
    idempotency_key = f"checkout-{hashlib.sha256(idempotency_source.encode('utf-8')).hexdigest()[:48]}"

    session = stripe.checkout.Session.create(
        **session_kwargs,
        idempotency_key=idempotency_key,
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


def schedule_cancel_stripe_subscription(
    stripe_subscription_id: str,
) -> stripe.Subscription:
    """Schedule cancellation at period end (no immediate access cut)."""
    return stripe.Subscription.modify(
        stripe_subscription_id,
        cancel_at_period_end=True,
    )


def create_stripe_subscription(
    *,
    customer_id: str,
    plan_name: str,
    billing_cycle: Literal["monthly", "annual"],
    workspace_id: str,
    idempotency_key: str | None = None,
) -> stripe.Subscription:
    """Create a new Stripe subscription for the selected plan/cycle."""
    price_id = get_price_id_for_plan(plan_name, billing_cycle)
    create_kwargs = {
        "customer": customer_id,
        "items": [{"price": price_id}],
        "metadata": {
            "workspace_id": workspace_id,
            "plan_name": plan_name,
            "billing_cycle": billing_cycle,
            "change_mode": "downgrade_apply",
        },
    }
    if idempotency_key:
        return stripe.Subscription.create(
            **create_kwargs,
            idempotency_key=idempotency_key,
        )
    return stripe.Subscription.create(**create_kwargs)


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
