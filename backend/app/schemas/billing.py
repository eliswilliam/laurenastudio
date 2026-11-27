"""
schemas/billing.py
Pydantic schemas for billing, subscription, plans, usage, and Stripe integration.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


# ── Plan ──────────────────────────────────────────────────────────────────────

class PlanRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    name: str
    display_name: str
    price_brl: float
    text_limit: int
    image_limit: int
    video_limit: int
    social_limit: int
    audio_limit: int  # 0 = unlimited
    site_publish_limit: int  # 0 = unlimited


# ── Subscription ──────────────────────────────────────────────────────────────

class SubscriptionRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    workspace_id: str
    plan_id: str
    status: str
    start_date: datetime
    current_period_end: datetime | None = None
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None
    billing_cycle: Literal["monthly", "annual"] | None = None
    cancel_at_period_end: bool = False
    current_price_brl: float | None = None
    currency: str | None = None
    next_plan_name: str | None = None
    next_plan_display_name: str | None = None
    next_billing_cycle: Literal["monthly", "annual"] | None = None


class SubscriptionWithPlan(SubscriptionRead):
    plan: PlanRead


# ── Activation (simulates Stripe webhook) ────────────────────────────────────

class ActivatePlanRequest(BaseModel):
    workspace_id: str
    plan_name: str  # "starter" | "pro" | "business"


class ActivatePlanResponse(BaseModel):
    message: str
    subscription: SubscriptionRead
    usage: "UsageRead"


# ── Cancellation ─────────────────────────────────────────────────────────────

class CancelSubscriptionRequest(BaseModel):
    workspace_id: str


class CancelSubscriptionResponse(BaseModel):
    message: str
    subscription: SubscriptionRead


# ── Change plan ──────────────────────────────────────────────────────────────

class ChangePlanRequest(BaseModel):
    plan_name: str
    billing_cycle: Literal["monthly", "annual"] = "monthly"


class ChangePlanResponse(BaseModel):
    action: Literal[
        "upgrade_checkout_required",
        "downgrade_scheduled",
        "no_change",
    ]
    message: str
    checkout_url: str | None = None
    checkout_session_id: str | None = None
    target_plan_name: str | None = None
    target_billing_cycle: Literal["monthly", "annual"] | None = None
    effective_on: str | None = None


# ── Usage ─────────────────────────────────────────────────────────────────────

class UsageRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    workspace_id: str
    text_used: int
    image_used: int
    video_used: int
    audio_used: int
    site_publishes_used: int
    period_start: datetime
    period_end: datetime


class UsageWithLimits(BaseModel):
    usage: UsageRead
    limits: PlanRead
    text_remaining: int
    image_remaining: int
    video_remaining: int
    audio_remaining: int
    site_publishes_remaining: int


# ── Billing status (combined view) ──────────────────────────────────────────

class BillingStatusResponse(BaseModel):
    subscription: SubscriptionWithPlan | None = None
    usage: UsageWithLimits | None = None
    is_active: bool


# ── Current subscription (simplified view) ──────────────────────────────────

class CurrentSubscriptionResponse(BaseModel):
    plan_name: str
    display_name: str
    price: float
    billing_cycle: Literal["monthly", "annual"] | None = None
    cancel_at_period_end: bool = False
    currency: str | None = None
    next_plan_name: str | None = None
    next_plan_display_name: str | None = None
    next_billing_cycle: Literal["monthly", "annual"] | None = None
    status: str
    current_period_end: str | None = None
    limits: PlanRead
    usage: UsageRead | None = None


# ── Stripe Checkout ──────────────────────────────────────────────────────────

class CheckoutSessionRequest(BaseModel):
    plan_name: str  # "starter" | "pro" | "business"
    billing_cycle: Literal["monthly", "annual"] = "monthly"
    success_url: str | None = None
    cancel_url: str | None = None


class CheckoutSessionResponse(BaseModel):
    session_id: str
    url: str


# ── Stripe Customer Portal ──────────────────────────────────────────────────

class CustomerPortalRequest(BaseModel):
    return_url: str | None = None


class CustomerPortalResponse(BaseModel):
    url: str


# ── Verify Checkout Session (direct Stripe API check) ──────────────────────

class VerifySessionRequest(BaseModel):
    session_id: str


class VerifySessionResponse(BaseModel):
    status: str  # "active" | "pending" | "canceled" | "expired"
    plan_name: str | None = None
    billing_cycle: Literal["monthly", "annual"] | None = None
    message: str


# Fix forward reference
ActivatePlanResponse.model_rebuild()
