from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, model_validator

from app.models.user import User


class UserRead(BaseModel):
    id: str
    email: EmailStr
    is_active: bool
    created_at: datetime
    full_name: str | None = None
    avatar_url: str | None = None
    google_id: str | None = None
    facebook_id: str | None = None
    phone: str | None = None
    bio: str | None = None
    """True if the user has a password (login e-mail). False for OAuth-only until they set one."""
    password_set: bool = False

    @model_validator(mode="before")
    @classmethod
    def _from_user_orm(cls, data: Any) -> Any:
        if isinstance(data, User):
            raw = data.avatar_url or ""
            # GCS avatars (uploaded manually) are served through the backend proxy
            # so the browser never needs direct GCS access (avoids 403 on private buckets).
            # External OAuth avatars (Google/Facebook) are served directly.
            if raw and "storage.googleapis.com" in raw:
                # Legacy GCS URL → rewrite to proxy path
                avatar_url: str | None = f"/api/v1/auth/avatar/{data.id}"
            elif raw and raw.startswith("/api/v1/auth/avatar/"):
                # Already a proxy path — keep as-is
                avatar_url = raw
            elif raw:
                # External OAuth avatar (Google/Facebook) — serve directly
                avatar_url = raw
            else:
                avatar_url = None
            return {
                "id": data.id,
                "email": data.email,
                "is_active": data.is_active,
                "created_at": data.created_at,
                "full_name": data.full_name,
                "avatar_url": avatar_url,
                "google_id": data.google_id,
                "facebook_id": data.facebook_id,
                "phone": data.phone,
                "bio": data.bio,
                "password_set": data.password_hash is not None,
            }
        return data


class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    new_password: str | None = None
    current_password: str | None = None  # required when changing password
