"""
routes/billing.py
Billing & subscription management endpoints.
Public: GET /plans
Protected (JWT): checkout, portal, cancel, change plan, get status, get usage
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_workspace_id
from app.db.session import get_db
from app.routes.auth import get_current_user
from app.schemas.billing import (
    ActivatePlanRequest,
    ActivatePlanResponse,
    BillingStatusResponse,
    CancelSubscriptionRequest,
    CancelSubscriptionResponse,
    ChangePlanRequest,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CurrentSubscriptionResponse,
    CustomerPortalRequest,
    CustomerPortalResponse,
    PlanRead,
    UsageWithLimits,
    VerifySessionRequest,
    VerifySessionResponse,
)
from app.services import billing_service
from app.services import stripe_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["Billing & Subscriptions"])


# ── GET /billing/plans (public — shown on pricing page) ─────────────────────

@router.get(
    "/plans",
    response_model=list[PlanRead],
    summary="List available plans",
    description="Returns all SaaS plans with pricing and limits. No auth required.",
)
async def list_plans(db: AsyncSession = Depends(get_db)) -> list[PlanRead]:
    return await billing_service.list_plans(db)


# ── POST /billing/create-checkout (Stripe Checkout Session) ─────────────────

@router.post(
    "/create-checkout",
    response_model=CheckoutSessionResponse,
    summary="Create a Stripe Checkout session",
    description=(
        "Generates a Stripe Checkout URL for the selected plan. "
        "The frontend redirects the user to this URL. "
        "On success, Stripe sends a webhook to activate the subscription."
    ),
)
async def create_checkout(
    payload: CheckoutSessionRequest,
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    try:
        session = stripe_service.create_checkout_session(
            plan_name=payload.plan_name,
            workspace_id=workspace_id,
            user_email=user.email,
            success_url=payload.success_url,
            cancel_url=payload.cancel_url,
        )
        return CheckoutSessionResponse(session_id=session.id, url=session.url)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Stripe checkout error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create Stripe checkout session.",
        )


# ── POST /billing/customer-portal (Stripe Customer Portal) ──────────────────

@router.post(
    "/customer-portal",
    response_model=CustomerPortalResponse,
    summary="Open Stripe Customer Portal",
    description=(
        "Returns a URL to the Stripe Customer Portal where the user can "
        "manage their subscription, update payment methods, or cancel."
    ),
)
async def customer_portal(
    payload: CustomerPortalRequest,
    _user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    sub = await billing_service.get_subscription_for_workspace(db, workspace_id)
    if not sub or not sub.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Stripe customer found for this workspace. Subscribe first.",
        )
    try:
        session = stripe_service.create_customer_portal_session(
            customer_id=sub.stripe_customer_id,
            return_url=payload.return_url,
        )
        return CustomerPortalResponse(url=session.url)
    except Exception as e:
        logger.error("Stripe portal error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create Stripe portal session.",
        )


# ── POST /billing/activate-plan (simulates Stripe webhook — dev only) ───────

@router.post(
    "/activate-plan",
    response_model=ActivatePlanResponse,
    summary="Activate a plan for a workspace (dev/test only)",
    description=(
        "Simulates a Stripe webhook for local development. "
        "In production, subscriptions are activated by the Stripe webhook."
    ),
)
async def activate_plan(
    payload: ActivatePlanRequest,
    _user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivatePlanResponse:
    return await billing_service.activate_plan(db, payload.workspace_id, payload.plan_name)


# ── POST /billing/cancel ────────────────────────────────────────────────────

@router.post(
    "/cancel",
    response_model=CancelSubscriptionResponse,
    summary="Cancel workspace subscription",
    description=(
        "Cancels the subscription on Stripe (if connected) and locally. "
        "Immediately blocks access to all protected resources."
    ),
)
async def cancel_subscription(
    payload: CancelSubscriptionRequest,
    _user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CancelSubscriptionResponse:
    return await billing_service.cancel_subscription(db, payload.workspace_id)


# ── POST /billing/change-plan ───────────────────────────────────────────────

@router.post(
    "/change-plan",
    response_model=ActivatePlanResponse,
    summary="Change to a different plan",
    description="Switches the plan and resets usage counters for the new billing period.",
)
async def change_plan(
    payload: ChangePlanRequest,
    _user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivatePlanResponse:
    return await billing_service.change_plan(db, payload.workspace_id, payload.plan_name)


# ── GET /billing/status ─────────────────────────────────────────────────────

@router.get(
    "/status",
    response_model=BillingStatusResponse,
    summary="Get billing status for the current workspace",
    description="Returns subscription, plan, usage, and remaining limits.",
)
async def billing_status(
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> BillingStatusResponse:
    return await billing_service.get_billing_status(db, workspace_id)


# ── GET /billing/current-subscription ────────────────────────────────────────

@router.get(
    "/current-subscription",
    response_model=CurrentSubscriptionResponse,
    summary="Get current subscription details",
    description=(
        "Returns plan_name, price, limits, current_period_end, status, "
        "and current usage for the workspace."
    ),
)
async def current_subscription(
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> CurrentSubscriptionResponse:
    return await billing_service.get_current_subscription(db, workspace_id)


# ── GET /billing/usage ──────────────────────────────────────────────────────

@router.get(
    "/usage",
    response_model=UsageWithLimits,
    summary="Get current usage and remaining limits",
    description="Shows resource consumption for the current billing period.",
)
async def get_usage(
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> UsageWithLimits:
    return await billing_service.get_usage(db, workspace_id)


# ── POST /billing/verify-session (direct Stripe check — works without webhook) ──

@router.post(
    "/verify-session",
    response_model=VerifySessionResponse,
    summary="Verify a Stripe Checkout Session and activate if paid",
    description=(
        "Retrieves the checkout session from Stripe API directly and "
        "activates the subscription if payment_status is 'paid'. "
        "This works without webhook delivery — essential for local dev "
        "and as a resilient fallback in production."
    ),
)
async def verify_session(
    payload: VerifySessionRequest,
    _user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> VerifySessionResponse:
    try:
        session = stripe_service.retrieve_checkout_session(payload.session_id)
    except Exception as e:
        logger.error("Failed to retrieve Stripe session %s: %s", payload.session_id, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not verify session with Stripe.",
        )

    sd = stripe_service.stripe_object_to_dict(session)
    payment_status = sd.get("payment_status")
    session_status = sd.get("status")  # "complete", "expired", "open"
    metadata = sd.get("metadata") or {}
    plan_name = metadata.get("plan_name")
    session_workspace = metadata.get("workspace_id")

    logger.info(
        "verify-session: session=%s status=%s payment_status=%s workspace=%s plan=%s",
        payload.session_id, session_status, payment_status, session_workspace, plan_name,
    )

    # Safety: only activate if the session belongs to this workspace
    if session_workspace and session_workspace != workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session does not belong to this workspace.",
        )

    if session_status == "expired":
        return VerifySessionResponse(
            status="expired",
            plan_name=plan_name,
            message="This checkout session has expired.",
        )

    if payment_status == "paid":
        # Activate the subscription (idempotent — safe to call multiple times)
        customer_id = sd.get("customer")
        stripe_subscription_id = sd.get("subscription")
        await billing_service.activate_plan(
            db,
            workspace_id=workspace_id,
            plan_name=plan_name,
            stripe_customer_id=customer_id,
            stripe_subscription_id=stripe_subscription_id,
        )
        return VerifySessionResponse(
            status="active",
            plan_name=plan_name,
            message=f"Subscription '{plan_name}' activated successfully!",
        )

    if payment_status == "unpaid":
        # Boleto or async payment — not confirmed yet
        return VerifySessionResponse(
            status="pending",
            plan_name=plan_name,
            message="Payment is pending (boleto). We'll activate once confirmed.",
        )

    # Any other state
    return VerifySessionResponse(
        status="pending",
        plan_name=plan_name,
        message=f"Session status: {session_status}, payment: {payment_status}",
    )
