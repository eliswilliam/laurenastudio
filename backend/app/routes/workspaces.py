"""
routes/workspaces.py
Workspace management endpoints — list, create, switch.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.routes.auth import get_current_user
from app.schemas.workspace import WorkspaceCreate, WorkspaceListResponse, WorkspaceRead
from app.services import workspace_service

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


@router.get(
    "",
    response_model=WorkspaceListResponse,
    summary="List user workspaces",
    description="Returns all workspaces owned by the authenticated user with plan limits.",
)
async def list_workspaces(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceListResponse:
    return await workspace_service.list_workspaces(db, user)


@router.post(
    "/create",
    response_model=WorkspaceRead,
    summary="Create a new workspace",
    description="Creates a new workspace if within the plan limit. Returns 403 if limit reached.",
)
async def create_workspace(
    payload: WorkspaceCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceRead:
    return await workspace_service.create_workspace(db, user, payload)
