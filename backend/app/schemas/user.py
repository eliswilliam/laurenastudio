from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    email: EmailStr
    is_active: bool
    created_at: datetime
    full_name: str | None = None
    avatar_url: str | None = None
    google_id: str | None = None
    phone: str | None = None
    bio: str | None = None


class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    new_password: str | None = None
    current_password: str | None = None  # required when changing password
