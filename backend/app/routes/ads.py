"""
routes/ads.py
Ads management — protected by active subscription.
"""
from fastapi import APIRouter, Depends

from app.core.dependencies import verify_active_subscription
from app.models.subscription import Subscription

router = APIRouter(prefix="/ads", tags=["Ads"])


@router.get(
    "/campaigns",
    summary="List ad campaigns",
    description="Requires active subscription.",
)
async def list_campaigns(
    _sub: Subscription = Depends(verify_active_subscription),
):
    return {
        "campaigns": [],
        "message": "Ads endpoint ready.",
    }
