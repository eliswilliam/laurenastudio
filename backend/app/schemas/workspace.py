from datetime import datetime

from pydantic import BaseModel


class WorkspaceRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    name: str
    owner_id: str
    created_at: datetime
