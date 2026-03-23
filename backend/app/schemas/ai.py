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


class AIVideoJobAccepted(BaseModel):
    """Video generation is queued (Veo); poll GET /ai/jobs/{job_id} until status is success."""

    job_id: str = Field(serialization_alias="jobId")
    resource_type: str = "video"
    usage_after: int = Field(serialization_alias="usageAfter")
    limit: int
    message: str = "Geração de vídeo em fila. Acompanhe com o jobId."


class MarketingVideoJobAccepted(BaseModel):
    """Marketing video queued; poll GET /ai/jobs/{job_id}."""

    job_id: str = Field(serialization_alias="jobId")
    usage_after: int = Field(serialization_alias="usageAfter")
    limit: int
    message: str = "Geração de vídeo em fila."


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
