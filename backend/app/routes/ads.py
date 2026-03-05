"""
routes/ads.py
Ads management — protected by active subscription.
"""
from fastapi import APIRouter, Depends

from app.core.dependencies import get_workspace_id, verify_active_subscription
from app.models.subscription import Subscription

router = APIRouter(prefix="/ads", tags=["Ads"])


@router.get(
    "/campaigns",
    summary="List ad campaigns",
    description="Requires active subscription.",
)
async def list_campaigns(
    workspace_id: str = Depends(get_workspace_id),
    _sub: Subscription = Depends(verify_active_subscription),
):
    return {
        "workspace_id": workspace_id,
        "campaigns": [],
        "message": "Ads endpoint ready.",
    }
