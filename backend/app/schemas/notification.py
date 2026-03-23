"""API schemas for user notifications."""
from pydantic import BaseModel, ConfigDict, Field


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: str
    title: str
    body: str
    link: str | None = None
    read: bool
    created_at: str = Field(..., description="ISO8601")


class NotificationListResponse(BaseModel):
    items: list[NotificationRead]
    unread_count: int
