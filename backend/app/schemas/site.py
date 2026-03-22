"""
schemas/site.py
Pydantic schemas for the site-builder endpoints.
"""
from pydantic import BaseModel, ConfigDict, Field


# ── Chat ─────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=5000)


class SiteChatRequest(BaseModel):
    project_id: str | None = None
    messages: list[ChatMessage] = Field(..., min_length=1)


class SiteChatResponse(BaseModel):
    project_id: str
    reply: str
    message_count: int


# ── Generate site ────────────────────────────────────────────────────────────

class GenerateSiteRequest(BaseModel):
    project_id: str


class GenerateSiteResponse(BaseModel):
    """Immediate response after enqueueing background generation."""

    model_config = ConfigDict(populate_by_name=True)

    job_id: str = Field(serialization_alias="jobId")
    project_id: str = Field(serialization_alias="projectId")
    message: str = "Geração em fila em segundo plano."


# ── Site status / info ───────────────────────────────────────────────────────

class DeploymentInfo(BaseModel):
    id: str
    status: str
    created_at: str
    github_repo_url: str | None = None
    cloud_run_service_name: str | None = None
    cloud_run_url: str | None = None
    site_url: str | None = None
    slug: str | None = None
    commit_sha: str | None = None
    error_message: str | None = None


class SiteStatusResponse(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    project_id: str
    project_name: str
    status: str
    preview_url: str | None = None
    download_url: str | None = None
    structure_json: str | None = None
    error_message: str | None = None
    user_prompt: str | None = None
    publish_slug: str | None = None
    github_repo_url: str | None = None
    cloud_run_url: str | None = None
    cloud_run_service_name: str | None = None
    site_url: str | None = None
    publication_status: str | None = None
    deployments: list[DeploymentInfo] = Field(default_factory=list)


# ── Projects list ────────────────────────────────────────────────────────────

class ProjectSummary(BaseModel):
    id: str
    name: str
    status: str
    created_at: str
    has_site: bool
