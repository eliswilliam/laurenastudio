"""
models/site_project.py
Stores Laurena site-builder projects (Criar site), prompt history and HTML artefacts.

Uses table prefix laurena_site_* to avoid conflict with legacy tables
site_projects (owner_id → users) used by older experiments.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class SiteProject(Base):
    """One project = one site the user is building (user-scoped)."""

    __tablename__ = "laurena_site_projects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False, default="Novo site")
    # Subdomain slug for Cloudflare CNAME (unique when set; see migration 011).
    publish_slug = Column(String(64), nullable=True, unique=True)
    # Last successful publish / public URLs (denormalized snapshot).
    github_repo_url = Column(String(500), nullable=True)
    cloud_run_url = Column(String(500), nullable=True)
    cloud_run_service_name = Column(String(255), nullable=True)
    site_url = Column(String(500), nullable=True)
    # Brief used at generate time (concat of user chat messages).
    user_prompt = Column(Text, nullable=True)
    # Last publish lifecycle: publishing | live | failed (null = never published).
    publication_status = Column(String(20), nullable=True)
    # Instant do POST /publish (fila) — usado para desbloquear « Pedir indexação » após GOOGLE_INDEXING_DEFER_SECONDS.
    last_publish_enqueue_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, default="draft")  # draft | generating | ready | error
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    prompts = relationship("SitePrompt", back_populates="project", cascade="all, delete-orphan", order_by="SitePrompt.created_at")
    site = relationship("GeneratedSite", back_populates="project", uselist=False, cascade="all, delete-orphan")
    deployments = relationship(
        "SiteDeployment",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    snapshots = relationship(
        "SiteGitSnapshot",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="SiteGitSnapshot.created_at.desc()",
    )


class SitePrompt(Base):
    """Each user message + assistant reply for a Laurena site project."""

    __tablename__ = "laurena_site_prompts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(
        String(36),
        ForeignKey("laurena_site_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(10), nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    model_used = Column(String(100), nullable=True)
    tokens_used = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    project = relationship("SiteProject", back_populates="prompts")


class GeneratedSite(Base):
    """Generated HTML + JSON structure for a Laurena site project."""

    __tablename__ = "laurena_generated_sites"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(
        String(36),
        ForeignKey("laurena_site_projects.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    structure_json = Column(Text, nullable=True)
    html_path = Column(String(500), nullable=True)
    preview_url = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    project = relationship("SiteProject", back_populates="site")


class SiteDeployment(Base):
    """One publish attempt (GitHub → Cloud Run → optional DNS). History per project."""

    __tablename__ = "laurena_site_deployments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(
        String(36),
        ForeignKey("laurena_site_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slug = Column(String(64), nullable=True)
    github_repo_url = Column(String(500), nullable=True)
    cloud_run_service_name = Column(String(255), nullable=True)
    cloud_run_url = Column(String(500), nullable=True)
    site_url = Column(String(500), nullable=True)
    commit_sha = Column(String(64), nullable=True)
    # pending | github_pushed | cloud_run_ready | success | failed
    status = Column(String(32), nullable=False, default="pending")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    project = relationship("SiteProject", back_populates="deployments")


class SiteGitSnapshot(Base):
    """Automatic git-like snapshot of virtual files after each saved assistant run."""

    __tablename__ = "laurena_site_git_snapshots"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(
        String(36),
        ForeignKey("laurena_site_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    commit_hash = Column(String(64), nullable=False, index=True)
    files_json = Column(Text, nullable=False)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    project = relationship("SiteProject", back_populates="snapshots")
