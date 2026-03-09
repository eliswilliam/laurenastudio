"""
routes/media.py
Media upload and listing endpoints.
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_workspace_id, verify_active_subscription
from app.db.session import get_db
from app.models.media import Media
from app.models.subscription import Subscription

router = APIRouter(prefix="/media", tags=["Media"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "media"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_TYPES = {
    "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
    "video/mp4", "video/webm", "video/quicktime",
}


@router.post(
    "/upload",
    summary="Upload a media file",
    status_code=status.HTTP_201_CREATED,
)
async def upload_media(
    file: UploadFile = File(...),
    workspace_id: str = Depends(get_workspace_id),
    subscription: Subscription = Depends(verify_active_subscription),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{file.content_type}' not allowed.",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 50MB limit.",
        )

    ext = Path(file.filename or "file").suffix or ".bin"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    filepath = UPLOAD_DIR / unique_name
    filepath.write_bytes(contents)

    media = Media(
        workspace_id=workspace_id,
        filename=unique_name,
        original_name=file.filename or "unknown",
        file_url=f"/uploads/media/{unique_name}",
        file_type=file.content_type or "application/octet-stream",
        file_size=len(contents),
        source="upload",
    )
    db.add(media)
    await db.commit()
    await db.refresh(media)

    return {
        "id": str(media.id),
        "filename": media.original_name,
        "url": media.file_url,
        "type": media.file_type,
        "size": media.file_size,
        "created_at": media.created_at.isoformat() if media.created_at else None,
    }


@router.get(
    "/",
    summary="List media for the current workspace",
)
async def list_media(
    workspace_id: str = Depends(get_workspace_id),
    subscription: Subscription = Depends(verify_active_subscription),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Media)
        .where(Media.workspace_id == workspace_id)
        .order_by(Media.created_at.desc())
    )
    items = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "filename": m.original_name,
            "url": m.file_url,
            "type": m.file_type,
            "size": m.file_size,
            "source": m.source,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in items
    ]


@router.delete(
    "/{media_id}",
    summary="Delete a media file",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_media(
    media_id: str,
    workspace_id: str = Depends(get_workspace_id),
    subscription: Subscription = Depends(verify_active_subscription),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Media).where(Media.id == media_id, Media.workspace_id == workspace_id)
    )
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found.")

    # Delete file from disk
    filepath = UPLOAD_DIR / media.filename
    if filepath.exists():
        filepath.unlink()

    await db.delete(media)
    await db.commit()
