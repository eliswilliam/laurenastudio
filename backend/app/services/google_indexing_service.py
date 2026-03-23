"""
Google Indexing API — notify Google Search of new/updated URLs (same GCP service account
as Cloud Run / domain mapping; Search Console property must include the submitted host).

https://developers.google.com/search/apis/indexing-api/v3/using-api
"""
from __future__ import annotations

import json
import logging
from typing import Any

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import settings
from app.services.dns_service import dns_configured
from app.services.github_publish_service import decode_gcp_sa_key

logger = logging.getLogger(__name__)

_INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing"


def _raw_service_account_json() -> str:
    raw = (settings.GCP_SA_KEY or "").strip()
    if raw:
        return raw
    return (settings.GOOGLE_CREDENTIALS_JSON or "").strip()


def indexing_credentials_available() -> bool:
    """True if env has a service account JSON we can use for the Indexing API."""
    return bool(_raw_service_account_json())


def build_indexing_service():
    """Sync: Google Indexing API v3 client (service account)."""
    raw = _raw_service_account_json()
    if not raw:
        raise RuntimeError("No GCP_SA_KEY / GOOGLE_CREDENTIALS_JSON for Indexing API")
    decoded = decode_gcp_sa_key(raw)
    info = json.loads(decoded)
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=[_INDEXING_SCOPE]
    )
    return build("indexing", "v3", credentials=creds, cache_discovery=False)


def resolve_subdomain_site_url(publish_slug: str | None) -> str | None:
    """
    Canonical public URL: https://{slug}.{ROOT_DOMAIN}/ for Search Console + Indexing API.
    """
    rd = (settings.ROOT_DOMAIN or "").strip().lstrip(".")
    slug = (publish_slug or "").strip().lower()
    if not rd or not slug:
        return None
    return f"https://{slug}.{rd}/"


def should_schedule_indexing_for_publish(
    *,
    project_id: str | None,
    slug: str | None,
) -> bool:
    """Only when custom subdomain publish is in use (DNS + slug + project)."""
    if not settings.GOOGLE_INDEXING_ENABLED:
        return False
    if not indexing_credentials_available():
        return False
    if not project_id or not (slug or "").strip():
        return False
    if not dns_configured():
        return False
    return True


def publish_url_updated(url: str) -> dict[str, Any]:
    """
    POST urlNotifications.publish with type URL_UPDATED.
    Runs synchronously (call from asyncio.to_thread in workers).
    """
    service = build_indexing_service()
    body = {"url": url, "type": "URL_UPDATED"}
    return service.urlNotifications().publish(body=body).execute()


def publish_url_safe(url: str) -> bool:
    """Returns True on success; logs HttpError and returns False on failure."""
    try:
        publish_url_updated(url)
        logger.info("Google Indexing API: notified URL_UPDATED for %s", url)
        return True
    except HttpError as e:
        if e.resp is not None and e.resp.status == 403:
            logger.warning(
                "Google Indexing API: 403 for %s — verify Search Console ownership "
                "for this host and Indexing API enabled for the GCP project.",
                url,
            )
        elif e.resp is not None and e.resp.status == 429:
            logger.warning("Google Indexing API: rate limit (429) for %s", url)
        else:
            logger.error("Google Indexing API: HTTP error for %s: %s", url, e)
        return False
    except Exception as exc:
        logger.exception("Google Indexing API: failed for %s: %s", url, exc)
        return False
