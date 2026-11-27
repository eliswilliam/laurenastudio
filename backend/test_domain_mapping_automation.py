"""
Tests du flux domain mapping GCP + Cloudflare (mocks HTTP, sans GCP/Cloudflare réels).

Exécution :
  cd backend && python -m unittest test_domain_mapping_automation -v
"""
from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from app.core.config import settings
from app.services.cloud_run_domain_mapping import DomainMappingError, ensure_mapped_domain_and_cloudflare_dns


def _resp(status: int, json_body: dict | None = None, text: str = "") -> MagicMock:
    r = MagicMock()
    r.status_code = status
    r.text = text or "{}"

    def _json() -> dict:
        return json_body if json_body is not None else {}

    r.json = _json
    return r


class FakeHttpxClient:
    """httpx.Client mock : une file de réponses partagée (post puis get(s))."""

    def __init__(self, responses: list[MagicMock], *args: object, **kwargs: object) -> None:
        self._responses = responses

    def __enter__(self) -> FakeHttpxClient:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def get(self, url: str, **kwargs: object) -> MagicMock:
        if not self._responses:
            raise AssertionError(f"GET sans réponse prévue: {url[:120]}")
        return self._responses.pop(0)

    def post(self, url: str, **kwargs: object) -> MagicMock:
        if not self._responses:
            raise AssertionError(f"POST sans réponse prévue: {url[:120]}")
        return self._responses.pop(0)


def _ctx_settings(**overrides: object) -> unittest.mock._patch:
    return patch.multiple(
        settings,
        GCP_SA_KEY='{"type":"service_account","project_id":"p"}',
        GCP_PROJECT_ID="proj-test",
        GCP_REGION="us-central1",
        ROOT_DOMAIN="example.com",
        **overrides,
    )


class TestEnsureMappedDomain(unittest.TestCase):
    def test_success_post_then_records_then_ready(self) -> None:
        apply_mock = MagicMock()
        dm_empty = {"status": {"resourceRecords": [], "conditions": []}}
        dm_with_recs = {
            "status": {
                "resourceRecords": [
                    {
                        "name": "demo.example.com",
                        "type": "CNAME",
                        "rrdata": "ghs.googlehosted.com.",
                    }
                ],
                "conditions": [],
            }
        }
        dm_ready = {
            "status": {
                "resourceRecords": dm_with_recs["status"]["resourceRecords"],
                "conditions": [{"type": "Ready", "status": "True", "message": "OK"}],
            }
        }
        queue = [_resp(201, dm_empty), _resp(200, dm_with_recs), _resp(200, dm_ready)]

        with patch(
            "app.services.cloud_run_domain_mapping.httpx.Client",
            side_effect=lambda *a, **k: FakeHttpxClient(queue),
        ), patch(
            "app.services.cloud_run_domain_mapping.get_gcp_access_token",
            return_value="fake-token",
        ), patch("app.services.cloud_run_domain_mapping.time.sleep"), patch(
            "app.services.cloud_run_domain_mapping.apply_google_resource_records_to_cloudflare",
            apply_mock,
        ), patch(
            "app.services.cloud_run_domain_mapping.dns_configured",
            return_value=True,
        ), _ctx_settings(
            GCP_DOMAIN_MAPPING_POLL_MAX_SECONDS=60,
            GCP_DOMAIN_MAPPING_POLL_INTERVAL_SECONDS=0,
        ):
            url = ensure_mapped_domain_and_cloudflare_dns("demo", service_name="svc-demo")

        self.assertEqual(url, "https://demo.example.com")
        apply_mock.assert_called_once()
        args, _ = apply_mock.call_args
        self.assertEqual(args[0], "demo")
        self.assertEqual(args[1], "example.com")
        self.assertEqual(len(args[2]), 1)

    def test_post_409_then_get_existing(self) -> None:
        apply_mock = MagicMock()
        dm_existing = {
            "status": {
                "resourceRecords": [
                    {"name": "x.example.com", "type": "A", "rrdata": "1.2.3.4"},
                ],
                "conditions": [],
            }
        }
        dm_ready = {
            "status": {
                "conditions": [{"type": "Ready", "status": "true"}],
            }
        }
        queue = [_resp(409, {}), _resp(200, dm_existing), _resp(200, dm_ready)]

        with patch(
            "app.services.cloud_run_domain_mapping.httpx.Client",
            side_effect=lambda *a, **k: FakeHttpxClient(queue),
        ), patch(
            "app.services.cloud_run_domain_mapping.get_gcp_access_token",
            return_value="fake-token",
        ), patch("app.services.cloud_run_domain_mapping.time.sleep"), patch(
            "app.services.cloud_run_domain_mapping.apply_google_resource_records_to_cloudflare",
            apply_mock,
        ), patch(
            "app.services.cloud_run_domain_mapping.dns_configured",
            return_value=True,
        ), _ctx_settings(
            GCP_DOMAIN_MAPPING_POLL_MAX_SECONDS=60,
            GCP_DOMAIN_MAPPING_POLL_INTERVAL_SECONDS=0,
        ):
            url = ensure_mapped_domain_and_cloudflare_dns("x", service_name="svc-x")

        self.assertEqual(url, "https://x.example.com")
        apply_mock.assert_called_once()

    def test_permission_denied_raises_immediately(self) -> None:
        """Réponse API réelle observée : conditions[].reason=PermissionDenied sans resourceRecords."""
        apply_mock = MagicMock()
        dm_perm = {
            "status": {
                "conditions": [
                    {
                        "type": "Ready",
                        "status": "False",
                        "reason": "PermissionDenied",
                        "message": "Caller is not authorized to administer the domain x.example.com.",
                    }
                ],
                "resourceRecords": [],
            }
        }
        queue = [_resp(201, dm_perm)]
        with patch(
            "app.services.cloud_run_domain_mapping.httpx.Client",
            side_effect=lambda *a, **k: FakeHttpxClient(queue),
        ), patch(
            "app.services.cloud_run_domain_mapping.get_gcp_access_token",
            return_value="fake-token",
        ), patch("app.services.cloud_run_domain_mapping.time.sleep"), patch(
            "app.services.cloud_run_domain_mapping.apply_google_resource_records_to_cloudflare",
            apply_mock,
        ), patch(
            "app.services.cloud_run_domain_mapping.dns_configured",
            return_value=True,
        ), patch.multiple(
            settings,
            GCP_SA_KEY='{"type":"service_account","project_id":"p","client_email":"test-sa@p.iam.gserviceaccount.com"}',
            GCP_PROJECT_ID="proj-test",
            GCP_REGION="us-central1",
            ROOT_DOMAIN="example.com",
            GCP_DOMAIN_MAPPING_POLL_MAX_SECONDS=60,
            GCP_DOMAIN_MAPPING_POLL_INTERVAL_SECONDS=0,
        ):
            with self.assertRaises(DomainMappingError) as ctx:
                ensure_mapped_domain_and_cloudflare_dns("x", service_name="svc")

        err = str(ctx.exception).lower()
        self.assertIn("not authorized", err)
        self.assertIn("test-sa@p.iam.gserviceaccount.com", str(ctx.exception))
        apply_mock.assert_not_called()

    def test_no_resource_records_timeout(self) -> None:
        """Fenêtre records courte : pas de resourceRecords → DomainMappingError."""
        apply_mock = MagicMock()
        dm_empty = {"status": {"resourceRecords": [], "conditions": []}}
        # POST + un GET après poll, puis monotonic dépasse la deadline au tour suivant
        queue = [_resp(201, dm_empty), _resp(200, dm_empty)]

        mono = [0.0]

        def monotonic_side() -> float:
            mono[0] += 500.0
            return mono[0]

        with patch(
            "app.services.cloud_run_domain_mapping.httpx.Client",
            side_effect=lambda *a, **k: FakeHttpxClient(queue),
        ), patch(
            "app.services.cloud_run_domain_mapping.get_gcp_access_token",
            return_value="fake-token",
        ), patch("app.services.cloud_run_domain_mapping.time.sleep"), patch(
            "app.services.cloud_run_domain_mapping.apply_google_resource_records_to_cloudflare",
            apply_mock,
        ), patch(
            "app.services.cloud_run_domain_mapping.dns_configured",
            return_value=True,
        ), patch(
            "app.services.cloud_run_domain_mapping.time.monotonic",
            side_effect=monotonic_side,
        ), _ctx_settings(
            GCP_DOMAIN_MAPPING_POLL_MAX_SECONDS=1,
            GCP_DOMAIN_MAPPING_POLL_INTERVAL_SECONDS=0,
        ):
            with self.assertRaises(DomainMappingError) as ctx:
                ensure_mapped_domain_and_cloudflare_dns("slow", service_name="svc")

        self.assertIn("resourceRecords", str(ctx.exception))
        apply_mock.assert_not_called()


if __name__ == "__main__":
    unittest.main()
