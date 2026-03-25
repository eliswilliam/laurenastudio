"""Schemas for Azure Speech (TTS) API."""
from pydantic import BaseModel, Field


class SpeechSynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)
    voice_name: str | None = Field(
        None,
        max_length=200,
        description="Optional Azure voice e.g. en-US-Ava:DragonHDLatestNeural",
    )
