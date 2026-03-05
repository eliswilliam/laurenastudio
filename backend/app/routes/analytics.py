"""
routes/analytics.py
Analytics — protected by active subscription.
"""
from fastapi import APIRouter, Depends

from app.core.dependencies import get_workspace_id, verify_active_subscription
from app.models.subscription import Subscription

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get(
    "/overview",
    summary="Get analytics overview",
    description="Requires active subscription.",
)
async def analytics_overview(
    workspace_id: str = Depends(get_workspace_id),
    _sub: Subscription = Depends(verify_active_subscription),
):
    return {
        "workspace_id": workspace_id,
        "data": {},
        "message": "Analytics endpoint ready.",
    }
