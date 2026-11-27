"""
Google Cloud Storage helpers — bucket builder_laurena.

Dossiers utilisés :
  avatar/   → avatars utilisateurs (laurenastudio)
  photos/   → images uploadées dans le chat builder (laurena b)

Authentification via GOOGLE_CREDENTIALS_JSON or GCP_SA_KEY (raw JSON or base64).
"""

import json
import logging
import os
import uuid
from datetime import timedelta
from typing import Optional
from urllib.parse import unquote, urlparse

from google.cloud import storage
from google.oauth2 import service_account

from app.core.google_credentials import decode_google_service_account_json

logger = logging.getLogger(__name__)
_STORAGE_HOST = "storage.googleapis.com"

_AVATAR_EXT: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}

GCS_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]


def _resolve_project_id() -> str | None:
    project = (os.environ.get("GCP_PROJECT_ID", "") or "").strip()
    if project:
        return project
    project = (os.environ.get("GOOGLE_CLOUD_PROJECT", "") or "").strip()
    return project or None


def _resolve_service_account_raw() -> str:
    # GCS bucket operations must prefer the deploy/storage service account.
    # GOOGLE_CREDENTIALS_JSON is often dedicated to Vertex AI and may not have
    # storage.objects.* permissions on builder_laurena.
    return (
        (os.environ.get("GCP_SA_KEY", "") or "").strip()
        or (os.environ.get("GOOGLE_CREDENTIALS_JSON", "") or "").strip()
    )


def _get_client() -> storage.Client:
    """Build a GCS client from service-account env vars, with ADC fallback."""
    project_id = _resolve_project_id()
    raw = _resolve_service_account_raw()

    if not raw:
        # Local/dev fallback when GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC exists.
        return storage.Client(project=project_id)

    decoded = decode_google_service_account_json(raw)
    if not decoded:
        raise RuntimeError(
            "GOOGLE_CREDENTIALS_JSON/GCP_SA_KEY non configurée — impossible de se connecter à GCS."
        )

    info: dict = json.loads(decoded)
    creds = service_account.Credentials.from_service_account_info(info, scopes=GCS_SCOPES)

    return storage.Client(
        credentials=creds,
        project=(info.get("project_id") or project_id),
    )


def upload_bytes(
    data: bytes,
    content_type: str,
    folder: str,
    filename: Optional[str] = None,
    bucket_name: Optional[str] = None,
    metadata: Optional[dict[str, str]] = None,
) -> str:
    """
    Upload des bytes vers GCS et retourne l'URL publique.

    Args:
        data:         Contenu binaire du fichier.
        content_type: MIME type (ex. "image/jpeg").
        folder:       Dossier dans le bucket (ex. "avatar", "photos").
        filename:     Nom du blob. Si None, généré avec uuid4.
        bucket_name:  Bucket cible. Défaut: env GCS_BUCKET ou "builder_laurena".

    Returns:
        URL publique — https://storage.googleapis.com/{bucket}/{folder}/{filename}
    """
    bucket_name = bucket_name or os.environ.get("GCS_BUCKET", "builder_laurena")

    if not filename:
        ext = _AVATAR_EXT.get(content_type, ".bin")
        filename = f"{uuid.uuid4().hex}{ext}"

    object_path = f"{folder}/{filename}"

    client = _get_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(object_path)
    if folder.strip("/") == "avatar":
        blob.cache_control = "no-store, max-age=0"
    if metadata:
        blob.metadata = metadata
    blob.upload_from_string(data, content_type=content_type)

    # NOTE: make_public() is intentionally NOT called here.
    # The bucket uses uniform bucket-level access (IAM), so object-level ACLs
    # are disabled and make_public() always raises a 400 error.
    # Avatars are served via the authenticated backend proxy (/api/v1/auth/avatar/{id}).
    # Other objects should use signed URLs (maybe_sign_gcs_url) or their own proxy.
    return blob.public_url  # canonical GCS URL — access depends on bucket IAM policy


def download_blob(
    object_path: str,
    bucket_name: Optional[str] = None,
) -> tuple[bytes, str]:
    """
    Download a GCS object via the authenticated service account.
    Returns (data, content_type).
    Raises google.cloud.exceptions.NotFound if the object doesn't exist.

    NOTE: blob.content_type is populated from GCS metadata, not from the download
    response headers. We call blob.reload() first so the content_type is always
    available (otherwise it would be None and we'd return application/octet-stream).
    """
    bucket_name = bucket_name or os.environ.get("GCS_BUCKET", "builder_laurena")
    client = _get_client()
    blob = client.bucket(bucket_name).blob(object_path)
    blob.reload()  # Load blob metadata (contentType, size, etc.) from GCS JSON API
    data = blob.download_as_bytes()
    return data, blob.content_type or "application/octet-stream"


def maybe_sign_gcs_url(url: str | None, expires_seconds: int = 3600) -> str | None:
    """
    If the URL points to Google Cloud Storage, return a temporary signed URL.
    Otherwise return the original URL unchanged.
    """
    if not url:
        return url

    raw = url.strip()
    if not raw:
        return raw

    parsed = urlparse(raw)
    host = (parsed.netloc or "").lower()
    if not host:
        return raw

    # Already signed; keep as-is.
    query_l = (parsed.query or "").lower()
    if "x-goog-algorithm=" in query_l and "x-goog-signature=" in query_l:
        return raw

    bucket = ""
    object_path = ""

    if host == _STORAGE_HOST:
        # Format: https://storage.googleapis.com/{bucket}/{object}
        parts = [p for p in parsed.path.split("/") if p]
        if len(parts) >= 2:
            bucket = parts[0]
            object_path = "/".join(parts[1:])
    elif host.endswith(f".{_STORAGE_HOST}"):
        # Format: https://{bucket}.storage.googleapis.com/{object}
        bucket = host[: -len(f".{_STORAGE_HOST}")]
        object_path = parsed.path.lstrip("/")

    if not bucket or not object_path:
        return raw

    try:
        client = _get_client()
        blob = client.bucket(bucket).blob(unquote(object_path))
        signed_url = blob.generate_signed_url(
            version="v4",
            method="GET",
            expiration=timedelta(seconds=max(60, int(expires_seconds))),
        )
        return signed_url
    except Exception as exc:
        logger.warning("gcs_service: signed URL generation failed for %s/%s: %s", bucket, object_path, exc)
        return raw
