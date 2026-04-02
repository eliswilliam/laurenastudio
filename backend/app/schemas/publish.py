"""Request/response models for POST /api/publish (GitHub + Cloud Run bootstrap)."""

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PublishFile(BaseModel):
    path: str
    content: str


class PublishRequest(BaseModel):
    user_id: str = Field(alias="userId")
    files: list[PublishFile] = Field(default_factory=list)
    project_id: str | None = Field(default=None, alias="projectId")
    slug: str | None = None

    model_config = {"populate_by_name": True}

    @field_validator("files", mode="before")
    @classmethod
    def _normalize_files(cls, v):
        return v or []


class SaveTemplateRequest(BaseModel):
    user_id: str = Field(alias="userId")
    files: list[PublishFile] = Field(default_factory=list)
    project_id: str | None = Field(default=None, alias="projectId")
    slug: str | None = None

    model_config = {"populate_by_name": True}

    @field_validator("files", mode="before")
    @classmethod
    def _normalize_files(cls, v):
        return v or []


class SaveTemplateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_id: str = Field(serialization_alias="projectId")
    message: str = "Estado do template salvo com sucesso."


class PublishResponse(BaseModel):
    """Réponse : URL pública canónica (siteUrl), repositório GitHub, diagnóstico Actions."""

    model_config = ConfigDict(populate_by_name=True)

    github: str
    site_url: str | None = Field(default=None, alias="siteUrl")
    deploy_ok: bool = Field(default=False, alias="deployOk")
    success: bool = Field(
        default=False,
        alias="success",
        description="Miroir de deployOk pour contrats qui attendent success.",
    )
    actions_url: str | None = Field(default=None, alias="actionsUrl")
    cloud_run: str | None = Field(default=None, alias="cloudRun")
    dns_applied: bool = Field(
        default=False,
        alias="dnsApplied",
        description="True si un enregistrement Cloudflare a été appliqué (URL canonique = sous-domaine).",
    )
