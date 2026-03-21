"""
Read Cloud Run service URL after GitHub Actions deploy (Run API v2).
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx
import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account

from app.core.config import settings
from app.services.github_publish_service import decode_gcp_sa_key

logger = logging.getLogger(__name__)

_SCOPES = ("https://www.googleapis.com/auth/cloud-platform",)
_TOKEN_REFRESH_ATTEMPTS = 5


def _is_transient_token_error(exc: BaseException) -> bool:
    """Réseau / TLS vers oauth2.googleapis.com (Docker, VPN, proxy, coupures transitoires)."""
    if isinstance(
        exc,
        (
            requests.exceptions.SSLError,
            requests.exceptions.ConnectionError,
            requests.exceptions.Timeout,
            requests.exceptions.ChunkedEncodingError,
        ),
    ):
        return True
    msg = str(exc).lower()
    return any(
        x in msg
        for x in (
            "ssl",
            "eof",
            "connection",
            "timeout",
            "max retries",
            "oauth2.googleapis.com",
        )
    )


def _access_token() -> str:
    raw = decode_gcp_sa_key(settings.GCP_SA_KEY)
    info = json.loads(raw)
    creds = service_account.Credentials.from_service_account_info(info, scopes=_SCOPES)
    req = Request()
    last: BaseException | None = None
    for attempt in range(1, _TOKEN_REFRESH_ATTEMPTS + 1):
        try:
            creds.refresh(req)
            if not creds.token:
                raise RuntimeError("Could not obtain GCP access token for Cloud Run API.")
            return creds.token
        except Exception as exc:
            last = exc
            if attempt >= _TOKEN_REFRESH_ATTEMPTS or not _is_transient_token_error(exc):
                break
            wait_s = min(2**attempt, 30)
            logger.warning(
                "GCP OAuth token refresh failed (%s/%s): %s — retry in %ss",
                attempt,
                _TOKEN_REFRESH_ATTEMPTS,
                exc,
                wait_s,
            )
            time.sleep(wait_s)
    assert last is not None
    raise RuntimeError(
        "GCP access token: échec après plusieurs tentatives (oauth2.googleapis.com). "
        "Vérifiez le réseau, VPN, pare-feu, ou réessayez. "
        f"Détail: {last}"
    ) from last


def get_gcp_access_token() -> str:
    """Token OAuth2 pour les APIs Cloud Run / domain mappings (même SA que le polling)."""
    return _access_token()


def fetch_cloud_run_uri(project_id: str, region: str, service_name: str) -> str | None:
    """
    GET run.googleapis.com/v2/.../services/{name} → uri (https://….run.app).
    Returns None if service not found (404) or uri not yet set.
    """
    token = get_gcp_access_token()
    url = (
        f"https://run.googleapis.com/v2/projects/{project_id}"
        f"/locations/{region}/services/{service_name}"
    )
    headers = {"Authorization": f"Bearer {token}"}
    try:
        with httpx.Client(timeout=45.0) as client:
            r = client.get(url, headers=headers)
    except Exception as exc:
        logger.warning("Cloud Run API request failed: %s", exc)
        return None

    if r.status_code == 404:
        return None
    if r.status_code != 200:
        logger.warning("Cloud Run API %s: %s", r.status_code, r.text[:500])
        return None

    data: dict[str, Any] = r.json()
    uri = data.get("uri")
    if isinstance(uri, str) and uri.startswith("https://"):
        return uri
    return None


def wait_for_cloud_run_url(
    project_id: str,
    region: str,
    service_name: str,
    *,
    max_seconds: int,
    interval_seconds: int,
) -> str | None:
    """Poll until service exists with a public URI or timeout."""
    deadline = time.monotonic() + max_seconds
    attempt = 0
    last_log = time.monotonic()
    while time.monotonic() < deadline:
        attempt += 1
        uri = fetch_cloud_run_uri(project_id, region, service_name)
        if uri:
            logger.info("Cloud Run URL resolved after %s attempts: %s", attempt, uri)
            return uri
        now = time.monotonic()
        if now - last_log >= 30.0:
            logger.info(
                "[publish] still waiting for Cloud Run service=%s (attempt %s, ~%ds left)",
                service_name,
                attempt,
                int(deadline - now),
            )
            last_log = now
        time.sleep(interval_seconds)
    logger.warning(
        "Cloud Run URL not available after %ss (service=%s). Check GitHub Actions.",
        max_seconds,
        service_name,
    )
    return None
