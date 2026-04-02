from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class NovidadeChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(default="")
    created_at: datetime | None = Field(default=None, alias="createdAt")


class GenerateCodeRequest(BaseModel):
    id: str | None = None
    messages: list[NovidadeChatMessage] = Field(default_factory=list)
    codebase_info: str = Field(default="", alias="codebaseInfo")
    attachments: list[dict[str, Any]] | None = None


class DbSaveRequest(BaseModel):
    id: str | None = None
    messages: list[NovidadeChatMessage] = Field(default_factory=list)
    files: dict[str, str] = Field(default_factory=dict)


class DbSaveResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    success: bool = True
    id: str
    queued: bool = True


class SnapshotItem(BaseModel):
    id: str
    project_id: str = Field(alias="projectId")
    commit_hash: str = Field(alias="commitHash")
    message: str | None = None
    created_at: str = Field(alias="createdAt")
    file_count: int = Field(alias="fileCount")
