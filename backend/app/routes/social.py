"""
routes/social.py
Social accounts management — protected by active subscription.
"""
from fastapi import APIRouter, Depends

from app.core.dependencies import get_workspace_id, verify_active_subscription
from app.models.subscription import Subscription

router = APIRouter(prefix="/social", tags=["Social Accounts"])


@router.get(
    "/accounts",
    summary="List connected social accounts",
    description="Requires active subscription.",
)
async def list_accounts(
    workspace_id: str = Depends(get_workspace_id),
    _sub: Subscription = Depends(verify_active_subscription),
):
    return {
        "workspace_id": workspace_id,
        "accounts": [],
        "message": "Social accounts endpoint ready. Connect accounts via OAuth.",
    }


@router.post(
    "/connect",
    summary="Connect a social account",
    description="Requires active subscription. Checks social account limit.",
)
async def connect_account(
    workspace_id: str = Depends(get_workspace_id),
    _sub: Subscription = Depends(verify_active_subscription),
):
    # TODO: Implement social account connection with limit checking
    return {
        "workspace_id": workspace_id,
        "message": "Social account connection endpoint ready.",
    }
