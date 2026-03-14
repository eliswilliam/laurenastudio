"""
schemas/ai.py
Pydantic schemas for AI generation endpoints.
"""
from pydantic import BaseModel, Field


class AIGenerateRequest(BaseModel):
    """Request to generate AI content."""
    resource_type: str  # "text" | "image" | "video"
    prompt: str
    model: str | None = None
    style: str | None = None


class AIGenerateResponse(BaseModel):
    """Response from AI generation."""
    resource_type: str
    content: str
    usage_after: int
    limit: int
    message: str


# ── Marketing AI schemas ─────────────────────────────────────────────────────

class MarketingImageRequest(BaseModel):
    brand_name: str = Field(..., min_length=1, max_length=200)
    ad_text: str = Field(..., min_length=1, max_length=2000)
    prompt: str | None = Field(None, max_length=2000)
    reference_image_b64: str | None = None
    reference_mime: str = "image/png"


class MarketingVideoRequest(BaseModel):
    brand_name: str = Field(..., min_length=1, max_length=200)
    ad_text: str = Field(..., min_length=1, max_length=2000)
    prompt: str | None = Field(None, max_length=2000)
    video_mode: str = Field("text_to_video", pattern="^(text_to_video|image_to_video)$")
    reference_image_b64: str | None = None
    reference_mime: str = "image/png"


class MarketingImageResponse(BaseModel):
    image_url: str | None = None
    ai_text: str | None = None
    usage_after: int
    limit: int
    message: str


class MarketingVideoResponse(BaseModel):
    video_url: str
    usage_after: int
    limit: int
    message: str
