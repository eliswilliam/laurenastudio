"""
services/workspace_service.py
Business logic for workspace management — creation, listing, plan-limit checks.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.membership import Membership
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.workspace import WorkspaceCreate, WorkspaceListResponse, WorkspaceRead


async def _get_workspace_limit_for_user(db: AsyncSession, user_id: str) -> int:
    """
    Return the workspace_limit from the user's active subscription plan.
    If no active subscription → default to 1 (starter behaviour).
    """
    result = await db.execute(
        select(Plan.workspace_limit)
        .join(Subscription, Subscription.plan_id == Plan.id)
        .join(Workspace, Workspace.id == Subscription.workspace_id)
        .where(
            Workspace.owner_id == user_id,
            Subscription.status == "active",
        )
        .order_by(Plan.workspace_limit.desc())
        .limit(1)
    )
    limit = result.scalar_one_or_none()
    return limit if limit is not None else 1


async def _count_user_workspaces(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(
        select(func.count()).select_from(Workspace).where(Workspace.owner_id == user_id)
    )
    return result.scalar_one()


async def list_workspaces(db: AsyncSession, user: User) -> WorkspaceListResponse:
    """List all workspaces owned by the user."""
    result = await db.execute(
        select(Workspace)
        .where(Workspace.owner_id == user.id)
        .order_by(Workspace.created_at.asc())
    )
    workspaces = result.scalars().all()
    count = len(workspaces)
    limit = await _get_workspace_limit_for_user(db, user.id)

    return WorkspaceListResponse(
        workspaces=[WorkspaceRead.model_validate(ws) for ws in workspaces],
        current_count=count,
        workspace_limit=limit,
    )


async def create_workspace(
    db: AsyncSession, user: User, payload: WorkspaceCreate
) -> WorkspaceRead:
    """Create a new workspace if within plan limits."""
    current_count = await _count_user_workspaces(db, user.id)
    limit = await _get_workspace_limit_for_user(db, user.id)

    # 0 = unlimited
    if limit > 0 and current_count >= limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Limite de workspaces atingido ({current_count}/{limit}). "
                f"Faça upgrade do seu plano para criar mais workspaces."
            ),
        )

    workspace = Workspace(
        id=str(uuid.uuid4()),
        name=payload.name.strip(),
        owner_id=user.id,
    )
    db.add(workspace)
    await db.flush()

    membership = Membership(
        id=str(uuid.uuid4()),
        user_id=user.id,
        workspace_id=workspace.id,
        role="admin",
    )
    db.add(membership)

    await db.commit()
    await db.refresh(workspace)

    return WorkspaceRead.model_validate(workspace)
