import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)  # None for OAuth-only users
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── OAuth / profile fields ────────────────────────────────────────────────
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    facebook_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bio: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    # First successful login/register welcome e-mail (SMTP) — NULL = not sent yet.
    welcome_email_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ────────────────────────────────────────────────────────
    workspaces: Mapped[list["Workspace"]] = relationship(  # noqa: F821
        "Workspace", back_populates="owner", cascade="all, delete-orphan"
    )
    memberships: Mapped[list["Membership"]] = relationship(  # noqa: F821
        "Membership", back_populates="user", cascade="all, delete-orphan"
    )
    password_resets: Mapped[list["PasswordReset"]] = relationship(  # noqa: F821
        "PasswordReset", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
