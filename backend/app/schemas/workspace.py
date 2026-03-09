from datetime import datetime

from pydantic import BaseModel


class WorkspaceRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    name: str
    owner_id: str
    created_at: datetime


class WorkspaceCreate(BaseModel):
    name: str


class WorkspaceListResponse(BaseModel):
    workspaces: list[WorkspaceRead]
    current_count: int
    workspace_limit: int  # 0 = unlimited
