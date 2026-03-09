"""
schemas/billing.py
Pydantic schemas for billing, subscription, plans, usage, and Stripe integration.
"""
from datetime import datetime

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
    post_limit: int
    workspace_limit: int


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
    workspace_id: str
    plan_name: str


# ── Usage ─────────────────────────────────────────────────────────────────────

class UsageRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    workspace_id: str
    text_used: int
    image_used: int
    video_used: int
    posts_used: int
    period_start: datetime
    period_end: datetime


class UsageWithLimits(BaseModel):
    usage: UsageRead
    limits: PlanRead
    text_remaining: int
    image_remaining: int
    video_remaining: int
    posts_remaining: int


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
    status: str
    current_period_end: str | None = None
    limits: PlanRead
    usage: UsageRead | None = None


# ── Stripe Checkout ──────────────────────────────────────────────────────────

class CheckoutSessionRequest(BaseModel):
    plan_name: str  # "starter" | "pro" | "business"
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
    message: str


# Fix forward reference
ActivatePlanResponse.model_rebuild()
