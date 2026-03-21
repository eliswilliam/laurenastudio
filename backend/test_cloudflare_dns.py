"""
Test Cloudflare DNS (API Laurena) — sans démarrer FastAPI.

1) Vérifie que CLOUDFLARE_TOKEN, CLOUDFLARE_ZONE_ID, ROOT_DOMAIN sont chargés.
2) Appelle l’API Cloudflare (GET zone) pour valider le token.
3) Optionnel : crée/met à jour un CNAME test slug → Cloud Run (comme publish.py).

Usage (depuis backend/) :
  python test_cloudflare_dns.py
  set TEST_CLOUD_RUN_URL=https://xxxx.run.app
  set TEST_DNS_SLUG=mon-test-123
  python test_cloudflare_dns.py
"""
from __future__ import annotations

import os
import sys
import time

import httpx

# Assure imports app.*
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings  # noqa: E402
from app.services.dns_service import (  # noqa: E402
    DnsError,
    _headers,
    create_subdomain,
    dns_configured,
)


def _verify_zone_read() -> None:
    zone_id = settings.CLOUDFLARE_ZONE_ID.strip()
    url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}"
    with httpx.Client(timeout=30.0) as client:
        r = client.get(url, headers=_headers())
    if r.status_code != 200:
        raise DnsError(f"GET zone {r.status_code}: {r.text[:400]}")
    data = r.json()
    if not data.get("success"):
        raise DnsError(f"Cloudflare zone: {data}")
    name = (data.get("result") or {}).get("name", "?")
    print(f"    Zone OK: {name}")


def main() -> int:
    print("=== test_cloudflare_dns.py ===\n")
    print("[1] dns_configured()")
    ok = dns_configured()
    print(f"    -> {ok}")
    if not ok:
        print("    FAIL: définir CLOUDFLARE_TOKEN, CLOUDFLARE_ZONE_ID, ROOT_DOMAIN dans backend/.env")
        return 1
    print(f"    ROOT_DOMAIN (longueur): {len(settings.ROOT_DOMAIN.strip())} chars")

    print("\n[2] GET /zones/{zone_id} (token + zone_id)")
    try:
        _verify_zone_read()
    except DnsError as e:
        print(f"    FAIL: {e}")
        return 1

    run_url = os.environ.get("TEST_CLOUD_RUN_URL", "").strip()
    if not run_url:
        print("\n[3] CNAME test — ignoré (pas de TEST_CLOUD_RUN_URL)")
        print("    Pour lier un sous-domaine à un déploiement Cloud Run, relancez avec :")
        print("    set TEST_CLOUD_RUN_URL=https://votre-service-xxxxx.run.app")
        print("    set TEST_DNS_SLUG=slug-unique  (optionnel)")
        return 0

    slug = os.environ.get("TEST_DNS_SLUG", "").strip() or f"e2e-{int(time.time())}"
    print(f"\n[3] create_subdomain(slug={slug!r}, cloud_run={run_url[:60]}...)")
    try:
        final = create_subdomain(slug, run_url)
    except (DnsError, ValueError) as e:
        print(f"    FAIL: {e}")
        return 1

    print(f"    OK URL canonique: {final}")
    print("\n=== Succès : enregistrement DNS Cloudflare appliqué (proxied CNAME). ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
