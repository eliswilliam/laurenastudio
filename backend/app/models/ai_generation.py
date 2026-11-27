"""
models/ai_generation.py
Stores AI generation history — prompts and responses.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text

from app.db.base import Base


class AIGeneration(Base):
    __tablename__ = "ai_generations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(
        String(36),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resource_type = Column(String(20), nullable=False)  # text, image, video
    prompt = Column(Text, nullable=False)
    content = Column(Text, nullable=False)  # generated text or image URL
    model_used = Column(String(100), nullable=True)
    style = Column(String(50), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
