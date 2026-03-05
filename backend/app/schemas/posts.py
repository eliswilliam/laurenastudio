"""
schemas/posts.py
Pydantic schemas for social media post endpoints.
"""
from datetime import datetime

from pydantic import BaseModel


class CreatePostRequest(BaseModel):
    """Request to create a social media post."""
    title: str
    content: str
    platform: str | None = None  # "instagram" | "tiktok" | "youtube" etc.
    scheduled_at: datetime | None = None


class PostResponse(BaseModel):
    """Response after creating a post."""
    id: str
    workspace_id: str
    title: str
    content: str
    platform: str | None = None
    scheduled_at: datetime | None = None
    created_at: datetime
    usage_after: int
    limit: int
    message: str
