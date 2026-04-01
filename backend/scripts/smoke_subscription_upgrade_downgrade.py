"""Smoke-test subscription upgrade/downgrade flows with mocked Stripe calls.

Run inside Docker API container:
  python scripts/smoke_subscription_upgrade_downgrade.py
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.membership import Membership
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.usage_tracking import UsageTracking
from app.models.user import User
from app.models.workspace import Workspace
from app.routes import webhook as webhook_routes
from app.services import billing_service, stripe_service


@dataclass
class _FakeCheckout:
    id: str
    url: str


@dataclass
class _FakeStripeCreatedSub:
    id: str


def _fake_stripe_subscription(
    subscription_id: str,
    *,
    plan_name: str,
    billing_cycle: str,
    amount_brl: int,
    cancel_at_period_end: bool = False,
    customer_id: str = "cus_smoke",
) -> dict:
    interval = "year" if billing_cycle == "annual" else "month"
    period_end = int((datetime.now(timezone.utc) + timedelta(days=365 if billing_cycle == "annual" else 30)).timestamp())
    return {
        "id": subscription_id,
        "customer": customer_id,
        "cancel_at_period_end": cancel_at_period_end,
        "current_period_end": period_end,
        "items": {
            "data": [
                {
                    "price": {
                        "id": f"price_{plan_name}_{billing_cycle}",
                        "unit_amount": amount_brl * 100,
                        "currency": "brl",
                        "recurring": {
                            "interval": interval,
                            "interval_count": 1,
                        },
                    }
                }
            ]
        },
    }


async def _ensure_plan(db, name: str, display: str, price: float, video_limit: int) -> Plan:
    r = await db.execute(select(Plan).where(Plan.name == name))
    plan = r.scalars().first()
    if plan:
        return plan
    plan = Plan(
        name=name,
        display_name=display,
        price_brl=price,
        text_limit=0,
        image_limit=0,
        video_limit=video_limit,
        social_limit=0,
        post_limit=0,
        audio_limit=0,
        site_publish_limit=0,
    )
    db.add(plan)
    await db.flush()
    return plan


async def main() -> None:
    # Preserve original Stripe integration callables.
    original_create_checkout = stripe_service.create_checkout_session
    original_retrieve_sub = stripe_service.retrieve_stripe_subscription
    original_cancel_sub = stripe_service.cancel_stripe_subscription
    original_create_sub = stripe_service.create_stripe_subscription
    original_schedule_cancel_sub = stripe_service.schedule_cancel_stripe_subscription

    fake_subscriptions: dict[str, dict] = {}
    canceled_subscriptions: list[str] = []

    def fake_create_checkout_session(**kwargs):
        assert kwargs.get("change_mode") in {"new", "upgrade"}
        return _FakeCheckout(id="cs_smoke_upgrade", url="https://stripe.local/checkout/upgrade")

    def fake_retrieve_subscription(subscription_id: str):
        if subscription_id not in fake_subscriptions:
            raise ValueError(f"Unknown fake subscription id: {subscription_id}")
        return fake_subscriptions[subscription_id]

    def fake_cancel_subscription(subscription_id: str):
        canceled_subscriptions.append(subscription_id)
        return {"id": subscription_id, "status": "canceled"}

    def fake_schedule_cancel(subscription_id: str):
        sub = fake_subscriptions.get(subscription_id)
        if sub:
            sub["cancel_at_period_end"] = True
        return {"id": subscription_id, "cancel_at_period_end": True}

    def fake_create_subscription(**kwargs):
        plan_name = kwargs["plan_name"]
        billing_cycle = kwargs["billing_cycle"]
        customer_id = kwargs["customer_id"]
        new_id = f"sub_new_{plan_name}_{billing_cycle}_{uuid.uuid4().hex[:8]}"
        amount = {"starter": 49, "pro": 129, "business": 349}[plan_name]
        if billing_cycle == "annual":
            amount *= 12
        fake_subscriptions[new_id] = _fake_stripe_subscription(
            new_id,
            plan_name=plan_name,
            billing_cycle=billing_cycle,
            amount_brl=amount,
            customer_id=customer_id,
        )
        return _FakeStripeCreatedSub(id=new_id)

    stripe_service.create_checkout_session = fake_create_checkout_session
    stripe_service.retrieve_stripe_subscription = fake_retrieve_subscription
    stripe_service.cancel_stripe_subscription = fake_cancel_subscription
    stripe_service.create_stripe_subscription = fake_create_subscription
    stripe_service.schedule_cancel_stripe_subscription = fake_schedule_cancel

    run_id = uuid.uuid4().hex[:10]
    workspace_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    old_sub_id = f"sub_old_business_monthly_{run_id}"

    try:
        async with AsyncSessionLocal() as db:
            starter = await _ensure_plan(db, "starter", "Starter", 49.0, 10)
            pro = await _ensure_plan(db, "pro", "Pro", 129.0, 40)
            business = await _ensure_plan(db, "business", "Business", 349.0, 100)

            user = User(
                id=user_id,
                email=f"smoke-updown-{run_id}@example.com",
                password_hash="smoke",
                is_active=True,
                full_name="Smoke Test",
            )
            workspace = Workspace(
                id=workspace_id,
                name=f"Smoke WS {run_id}",
                owner_id=user_id,
            )
            membership = Membership(
                user_id=user_id,
                workspace_id=workspace_id,
                role="admin",
            )

            now = datetime.now(timezone.utc)
            subscription = Subscription(
                workspace_id=workspace_id,
                plan_id=business.id,
                status="active",
                start_date=now,
                current_period_end=now + timedelta(days=30),
                stripe_customer_id="cus_smoke",
                stripe_subscription_id=old_sub_id,
            )
            usage = UsageTracking(
                workspace_id=workspace_id,
                text_used=5,
                image_used=3,
                video_used=2,
                audio_used=1,
                site_publishes_used=1,
                period_start=now,
                period_end=now + timedelta(days=30),
            )

            db.add_all([user, workspace, membership, subscription, usage])
            await db.commit()

            fake_subscriptions[old_sub_id] = _fake_stripe_subscription(
                old_sub_id,
                plan_name="business",
                billing_cycle="monthly",
                amount_brl=349,
                customer_id="cus_smoke",
            )

            # 1) Downgrade should be scheduled (no immediate switch).
            downgrade = await billing_service.change_plan(
                db,
                workspace_id=workspace_id,
                plan_name="pro",
                billing_cycle="monthly",
                user_email=user.email,
            )
            assert downgrade.action == "downgrade_scheduled", downgrade
            local_sub = await billing_service.get_subscription_for_workspace(db, workspace_id)
            assert local_sub is not None
            assert local_sub.next_plan_id == pro.id
            assert local_sub.plan_id == business.id

            # 2) Period-end application should cancel old Stripe sub and create new one.
            applied = await billing_service.apply_scheduled_plan_change(
                db,
                workspace_id=workspace_id,
                stripe_subscription_id=old_sub_id,
                stripe_customer_id="cus_smoke",
                trigger_event_id="evt_smoke_rollover",
            )
            assert applied is not None
            local_sub = await billing_service.get_subscription_for_workspace(db, workspace_id)
            assert local_sub is not None
            assert local_sub.status == "active"
            assert local_sub.plan_id == pro.id
            assert local_sub.next_plan_id is None
            assert local_sub.next_billing_cycle is None
            assert local_sub.stripe_subscription_id and local_sub.stripe_subscription_id != old_sub_id
            assert old_sub_id in canceled_subscriptions

            usage_row = await db.execute(select(UsageTracking).where(UsageTracking.workspace_id == workspace_id))
            usage_obj = usage_row.scalars().first()
            assert usage_obj is not None
            assert usage_obj.text_used == 0
            assert usage_obj.image_used == 0
            assert usage_obj.video_used == 0
            assert usage_obj.audio_used == 0
            assert usage_obj.site_publishes_used == 0

            # 3) Upgrade should require checkout URL (immediate switch path).
            upgrade = await billing_service.change_plan(
                db,
                workspace_id=workspace_id,
                plan_name="business",
                billing_cycle="annual",
                user_email=user.email,
            )
            assert upgrade.action == "upgrade_checkout_required", upgrade
            assert upgrade.checkout_url

            # 4) Webhook safety: stale deleted sub must not cancel active new sub.
            stale_deleted_event = {
                "data": {
                    "object": {
                        "id": old_sub_id,
                        "metadata": {"workspace_id": workspace_id},
                    }
                }
            }
            await webhook_routes._handle_subscription_deleted(stale_deleted_event, db)  # noqa: SLF001

            local_sub = await billing_service.get_subscription_for_workspace(db, workspace_id)
            assert local_sub is not None
            assert local_sub.status == "active"

            print("[OK] Downgrade scheduled + applied at period end")
            print("[OK] Upgrade returns checkout flow (no immediate DB switch)")
            print("[OK] Stale subscription.deleted does not cancel new active plan")

            # Cleanup test data
            await db.delete(usage_obj)
            await db.delete(local_sub)
            await db.delete(membership)
            await db.delete(workspace)
            await db.delete(user)
            await db.commit()

    finally:
        stripe_service.create_checkout_session = original_create_checkout
        stripe_service.retrieve_stripe_subscription = original_retrieve_sub
        stripe_service.cancel_stripe_subscription = original_cancel_sub
        stripe_service.create_stripe_subscription = original_create_sub
        stripe_service.schedule_cancel_stripe_subscription = original_schedule_cancel_sub


if __name__ == "__main__":
    asyncio.run(main())
