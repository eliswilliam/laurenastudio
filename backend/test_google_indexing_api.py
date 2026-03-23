"""
Google Indexing API — tests.

- Tests unitaires : sans réseau (resolve URL, disponibilité des clés).
- Test live : appelle l’API Google (getMetadata) si RUN_GOOGLE_INDEXING_LIVE_TEST=1
  et GCP_SA_KEY / GOOGLE_CREDENTIALS_JSON sont définis.

  PowerShell:
    cd backend
    $env:RUN_GOOGLE_INDEXING_LIVE_TEST="1"
    pytest test_google_indexing_api.py -v -m live_indexing

  Ou URL explicite:
    $env:GOOGLE_INDEXING_TEST_URL="https://monslug.mondomaine.pro/"
"""
from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from app.core.config import settings
from app.services import google_indexing_service as gis
from googleapiclient.errors import HttpError


def test_resolve_subdomain_site_url_none_without_root():
    with patch.object(settings, "ROOT_DOMAIN", ""):
        assert gis.resolve_subdomain_site_url("foo") is None


def test_resolve_subdomain_site_url_https_with_slash():
    with patch.object(settings, "ROOT_DOMAIN", "example.com"):
        assert gis.resolve_subdomain_site_url("bar") == "https://bar.example.com/"


def test_indexing_credentials_available_requires_raw_json():
    with patch.object(gis, "_raw_service_account_json", return_value=""):
        assert gis.indexing_credentials_available() is False
    with patch.object(gis, "_raw_service_account_json", return_value="{}"):
        assert gis.indexing_credentials_available() is True


@pytest.mark.live_indexing
def test_live_indexing_api_auth_and_get_metadata():
    """
    Vérifie que le client Indexing API se construit et que getMetadata répond
    (200 / 404 métier) — pas 401/403 liés à l’auth ou à Search Console.
    """
    if os.getenv("RUN_GOOGLE_INDEXING_LIVE_TEST", "").strip().lower() not in (
        "1",
        "true",
        "yes",
    ):
        pytest.skip("Set RUN_GOOGLE_INDEXING_LIVE_TEST=1 to run this test")

    if not gis.indexing_credentials_available():
        pytest.skip("No GCP_SA_KEY / GOOGLE_CREDENTIALS_JSON in environment")

    test_url = (os.getenv("GOOGLE_INDEXING_TEST_URL") or "").strip()
    if not test_url:
        slug = (os.getenv("GOOGLE_INDEXING_TEST_SLUG") or "healthcheck").strip().lower()
        rd = (settings.ROOT_DOMAIN or "").strip().lstrip(".")
        if not rd:
            pytest.skip("Set GOOGLE_INDEXING_TEST_URL or ROOT_DOMAIN + GOOGLE_INDEXING_TEST_SLUG")
        test_url = f"https://{slug}.{rd}/"

    service = gis.build_indexing_service()
    try:
        meta = service.urlNotifications().getMetadata(url=test_url).execute()
    except HttpError as e:
        status = e.resp.status if e.resp else None
        if status == 403:
            pytest.fail(
                "403 Permission denied — vérifier: (1) Indexing API activée sur le projet GCP, "
                "(2) le client_email du compte de service est propriétaire dans Search Console "
                f"pour l’hôte de cette URL. URL testée: {test_url}"
            )
        if status == 401:
            pytest.fail("401 Unauthorized — clé JSON ou scope indexing invalide.")
        if status == 404:
            # Certaines réponses 404 indiquent « aucune notification » — l’auth est OK.
            return
        raise
    assert meta is not None
    # Réponse typique: latestUpdate.* ou notificationMetadata
    assert isinstance(meta, dict)


@pytest.mark.live_indexing
def test_live_publish_url_updated_optional():
    """
    Envoie une vraie notification URL_UPDATED (consomme le quota Indexing API).
    Uniquement si RUN_GOOGLE_INDEXING_LIVE_PUBLISH=1 en plus du live test.
    """
    if os.getenv("RUN_GOOGLE_INDEXING_LIVE_PUBLISH", "").strip().lower() not in (
        "1",
        "true",
        "yes",
    ):
        pytest.skip("Set RUN_GOOGLE_INDEXING_LIVE_PUBLISH=1 to actually publish (uses quota)")

    if os.getenv("RUN_GOOGLE_INDEXING_LIVE_TEST", "").strip().lower() not in (
        "1",
        "true",
        "yes",
    ):
        pytest.skip("Also set RUN_GOOGLE_INDEXING_LIVE_TEST=1")

    if not gis.indexing_credentials_available():
        pytest.skip("No GCP_SA_KEY / GOOGLE_CREDENTIALS_JSON")

    test_url = (os.getenv("GOOGLE_INDEXING_TEST_URL") or "").strip()
    if not test_url:
        slug = (os.getenv("GOOGLE_INDEXING_TEST_SLUG") or "healthcheck").strip().lower()
        rd = (settings.ROOT_DOMAIN or "").strip().lstrip(".")
        if not rd:
            pytest.skip("Set GOOGLE_INDEXING_TEST_URL or ROOT_DOMAIN")
        test_url = f"https://{slug}.{rd}/"

    ok = gis.publish_url_safe(test_url)
    assert ok is True, "publish_url_safe returned False — see logs for HttpError"


def test_build_indexing_service_raises_without_credentials():
    with patch.object(gis, "_raw_service_account_json", return_value=""):
        with pytest.raises(RuntimeError, match="No GCP_SA_KEY"):
            gis.build_indexing_service()
