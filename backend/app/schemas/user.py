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
