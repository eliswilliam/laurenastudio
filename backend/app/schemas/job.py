"""Pydantic schemas for background job polling (generate / publish)."""

from datetime import datetime
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from app.models.background_job import BackgroundJob


class JobLogEntry(BaseModel):
    ts: str
    message: str


class BackgroundJobResponse(BaseModel):
    model_config = {"populate_by_name": True}

    job_id: str = Field(serialization_alias="jobId")
    job_type: str = Field(serialization_alias="jobType")
    status: str
    project_id: str | None = Field(serialization_alias="projectId")
    user_id: str = Field(serialization_alias="userId")
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")
    result: dict[str, Any] | None = None
    error: str | None = None
    logs: list[JobLogEntry] = Field(default_factory=list)

    @classmethod
    def from_model(cls, job: "BackgroundJob") -> "BackgroundJobResponse":
        raw_logs = job.logs or []
        entries: list[JobLogEntry] = []
        for item in raw_logs:
            if isinstance(item, dict) and "message" in item:
                entries.append(
                    JobLogEntry(ts=str(item.get("ts", "")), message=str(item["message"]))
                )
        return cls(
            job_id=str(job.id),
            job_type=job.job_type,
            status=job.status,
            project_id=job.project_id,
            user_id=job.user_id,
            created_at=job.created_at,
            updated_at=job.updated_at,
            result=job.result if isinstance(job.result, dict) else None,
            error=job.error,
            logs=entries,
        )


class GenerateEnqueueResponse(BaseModel):
    job_id: str
    project_id: str
    message: str = "Geração iniciada em segundo plano."


class PublishEnqueueResponse(BaseModel):
    model_config = {"populate_by_name": True}

    job_id: str = Field(serialization_alias="jobId")
    project_id: str | None = Field(default=None, serialization_alias="projectId")
    message: str = "Publicação em fila em segundo plano."
