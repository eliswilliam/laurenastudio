"""
Test réel : uniquement domain mapping GCP + DNS Cloudflare pour le slug demandé (pas GitHub/Actions).

Par défaut slug = zar. Le service Cloud Run cible :
  - variable TEST_CLOUD_RUN_SERVICE_NAME si définie
  - sinon le dernier service listé dans la région (Run API v2)

Usage (depuis la racine du dépôt) :
  docker compose exec api python scripts/test_mapping_zar.py

  # Certificat Google parfois > 15 min : augmenter la fenêtre Ready (secondes)
  docker compose exec -e TEST_MAPPING_POLL_MAX_SECONDS=1800 api python scripts/test_mapping_zar.py

  TEST_MAPPING_SLUG=zar TEST_CLOUD_RUN_SERVICE_NAME=mon-service docker compose exec -e TEST_MAPPING_SLUG -e TEST_CLOUD_RUN_SERVICE_NAME api python scripts/test_mapping_zar.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx

from app.core.config import settings
from app.services.cloud_run_domain_mapping import DomainMappingError, ensure_mapped_domain_and_cloudflare_dns
from app.services.cloud_run_lookup import get_gcp_access_token
from app.services.dns_service import DnsError, dns_configured


def _apply_poll_override() -> None:
    """Optionnel : TEST_MAPPING_POLL_MAX_SECONDS remplace GCP_DOMAIN_MAPPING_POLL_MAX_SECONDS pour ce run."""
    raw = os.environ.get("TEST_MAPPING_POLL_MAX_SECONDS", "").strip()
    if not raw:
        return
    try:
        sec = int(raw)
    except ValueError:
        return
    if sec < 60:
        return
    try:
        object.__setattr__(settings, "GCP_DOMAIN_MAPPING_POLL_MAX_SECONDS", sec)
    except Exception:
        return
    print(f"(poll Ready max: {sec}s)\n")


def _list_service_names(project_id: str, region: str) -> list[str]:
    token = get_gcp_access_token()
    url = f"https://run.googleapis.com/v2/projects/{project_id}/locations/{region}/services"
    with httpx.Client(timeout=60.0) as client:
        r = client.get(url, headers={"Authorization": f"Bearer {token}"})
    if r.status_code != 200:
        raise RuntimeError(f"List services {r.status_code}: {r.text[:800]}")
    data = r.json()
    out: list[str] = []
    for s in data.get("services") or []:
        name = (s.get("name") or "").split("/")[-1]
        if name:
            out.append(name)
    return sorted(out)


def main() -> int:
    _apply_poll_override()
    slug = (os.environ.get("TEST_MAPPING_SLUG") or "zar").strip().lower()
    project_id = settings.GCP_PROJECT_ID.strip()
    region = (settings.GCP_REGION or "us-central1").strip()
    root = settings.ROOT_DOMAIN.strip().lower().rstrip(".")

    print("=== test_mapping_zar.py (mapping + Cloudflare seulement) ===\n")
    if not dns_configured():
        print("FAIL: Cloudflare / ROOT_DOMAIN non configurés (dns_configured=False).")
        return 1
    if not settings.GCP_SA_KEY.strip():
        print("FAIL: GCP_SA_KEY manquant.")
        return 1
    if not project_id:
        print("FAIL: GCP_PROJECT_ID manquant.")
        return 1

    explicit = os.environ.get("TEST_CLOUD_RUN_SERVICE_NAME", "").strip()
    if explicit:
        service_name = explicit
        print(f"Service Cloud Run (env): {service_name}")
    else:
        names = _list_service_names(project_id, region)
        if not names:
            print("FAIL: aucun service Cloud Run dans la région. Définissez TEST_CLOUD_RUN_SERVICE_NAME.")
            return 1
        service_name = names[-1]
        print(f"Services dans {region}: {len(names)} — utilisation du dernier trié: {service_name}")
        print(f"  (tous: {', '.join(names[:12])}{'…' if len(names) > 12 else ''})")

    fqdn = f"{slug}.{root}"
    print(f"\nSlug: {slug}")
    print(f"FQDN attendu: {fqdn}")
    print(f"Route Cloud Run: {service_name}\n")

    try:
        url = ensure_mapped_domain_and_cloudflare_dns(slug, service_name=service_name)
    except (DnsError, DomainMappingError) as e:
        err = str(e)
        print(f"FAIL: {err}")
        if "ready" in err.lower() or "certificate" in err.lower():
            print(
                "\nNote: le mapping et les DNS peuvent déjà être OK ; le certificat Google peut "
                "dépasser la fenêtre de poll. Vérifier Cloud Run → Domain mappings ou relancer avec "
                "TEST_MAPPING_POLL_MAX_SECONDS=1800"
            )
        return 1

    print(f"\nOK — URL canonique retournée par l’API (comme après publish) : {url}")
    if url.rstrip("/") != f"https://{fqdn}":
        print(f"WARN: attendu https://{fqdn}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
