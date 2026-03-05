"""
schemas/ai.py
Pydantic schemas for AI generation endpoints.
"""
from pydantic import BaseModel


class AIGenerateRequest(BaseModel):
    """Request to generate AI content."""
    resource_type: str  # "text" | "image" | "video"
    prompt: str
    # Additional params can be added per resource_type
    model: str | None = None
    style: str | None = None


class AIGenerateResponse(BaseModel):
    """Response from AI generation."""
    resource_type: str
    content: str  # generated text, image URL, or video URL
    usage_after: int  # new counter value
    limit: int  # plan limit (0 = unlimited)
    message: str
