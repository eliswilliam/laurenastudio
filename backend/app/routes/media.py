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

# SECURITY: magic bytes pour chaque type autorisé (validation côté serveur)
# Le client peut falsifier Content-Type — les magic bytes ne mentent pas.
_MAGIC_BYTES: list[tuple[bytes, str]] = [
    (b"\x89PNG\r\n\x1a\n",      "image/png"),
    (b"\xff\xd8\xff",            "image/jpeg"),
    (b"GIF87a",                  "image/gif"),
    (b"GIF89a",                  "image/gif"),
    (b"RIFF",                    "video/webm"),   # aussi WebP
    (b"\x1aE\xdf\xa3",          "video/webm"),
    (b"\x00\x00\x00\x18ftyp",   "video/mp4"),
    (b"\x00\x00\x00\x1cftyp",   "video/mp4"),
    (b"\x00\x00\x00 ftyp",      "video/mp4"),
    (b"ftyp",                    "video/mp4"),
]

def _detect_mime_from_magic(data: bytes) -> str | None:
    """Détecte le type MIME réel à partir des magic bytes."""
    for magic, mime in _MAGIC_BYTES:
        if data[:len(magic)] == magic:
            return mime
    # WebP: RIFF....WEBP
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    # QuickTime / MOV
    if len(data) >= 8 and data[4:8] in (b"moov", b"mdat", b"ftyp", b"free", b"skip"):
        return "video/quicktime"
    return None


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
    # Vérification du Content-Type déclaré (première ligne de défense)
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FILE_TYPE_NOT_ALLOWED",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="FILE_TOO_LARGE",
        )

    # SECURITY: validation des magic bytes (le client peut falsifier Content-Type)
    detected_mime = _detect_mime_from_magic(contents)
    if detected_mime is None or detected_mime not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FILE_CONTENT_MISMATCH",
        )

    # Extension basée sur le type détecté (pas sur le nom du fichier)
    _MIME_TO_EXT = {
        "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif",
        "image/webp": ".webp", "video/mp4": ".mp4",
        "video/webm": ".webm", "video/quicktime": ".mov",
    }
    ext = _MIME_TO_EXT.get(detected_mime, ".bin")
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

    # SECURITY: resolve() + parent check ensures we never unlink anything outside
    # UPLOAD_DIR, even if media.filename were ever populated from untrusted data
    # (today it's a UUID, but defense-in-depth costs nothing here).
    uploads_root = UPLOAD_DIR.resolve()
    try:
        filepath = (UPLOAD_DIR / media.filename).resolve()
    except (OSError, ValueError):
        filepath = None
    if filepath and uploads_root in filepath.parents and filepath.is_file():
        filepath.unlink()

    await db.delete(media)
    await db.commit()
