"""
Vérification **live** (lecture seule) d'un domain mapping Cloud Run + DNS attendu.

Sans modifier GCP : appelle GET sur l'API domains.cloudrun.com et affiche status / resourceRecords.

Prérequis : backend/.env avec GCP_PROJECT_ID, GCP_SA_KEY, ROOT_DOMAIN.
Optionnel : TEST_DOMAIN_SLUG (défaut: test-mapping-check)

  cd backend && python test_domain_mapping_live.py
"""
from __future__ import annotations

import json
import os
import sys
from urllib.parse import quote

import httpx

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings  # noqa: E402
from app.services.cloud_run_domain_mapping import _dm_api_base  # noqa: E402
from app.services.cloud_run_lookup import get_gcp_access_token  # noqa: E402


def main() -> int:
    print("=== test_domain_mapping_live.py (GET read-only) ===\n")

    project = settings.GCP_PROJECT_ID.strip()
    root = settings.ROOT_DOMAIN.strip().lower().rstrip(".")
    if not project or not root:
        print("SKIP: définir GCP_PROJECT_ID et ROOT_DOMAIN dans backend/.env")
        return 0

    if not settings.GCP_SA_KEY.strip():
        print("SKIP: GCP_SA_KEY manquant (nécessaire pour le token)")
        return 0

    slug = os.environ.get("TEST_DOMAIN_SLUG", "test-mapping-check").strip().lower()
    fqdn = f"{slug}.{root}"
    enc = quote(fqdn, safe="")

    region = (settings.GCP_REGION or "us-central1").strip()
    token = get_gcp_access_token()
    url = f"{_dm_api_base(region)}/namespaces/{project}/domainmappings/{enc}"
    print(f"GET {url[:90]}…")
    print(f"  FQDN: {fqdn}\n")

    with httpx.Client(timeout=120.0) as client:
        r = client.get(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )

    print(f"HTTP {r.status_code}")
    if r.status_code == 404:
        print("  Aucun domain mapping pour ce FQDN (normal si jamais publié avec ce slug).")
        return 0
    if r.status_code != 200:
        print(r.text[:1200])
        return 1

    data = r.json()
    status = data.get("status") or {}
    conds = status.get("conditions") or []
    recs = status.get("resourceRecords") or []

    print("metadata.name:", (data.get("metadata") or {}).get("name"))
    print("spec.routeName:", (data.get("spec") or {}).get("routeName"))
    print()
    print("resourceRecords:", len(recs))
    for i, rec in enumerate(recs):
        print(f"  [{i}] {json.dumps(rec, ensure_ascii=False)}")
    print()
    print("conditions:")
    for c in conds:
        print(
            f"  - type={c.get('type')} status={c.get('status')} reason={c.get('reason')!r}"
        )

    ready = any(
        (c.get("type") or "").lower() == "ready" and str(c.get("status")).lower() == "true"
        for c in conds
    )
    print()
    if ready and recs:
        print("OK — mapping présent, Ready, et resourceRecords non vides (DNS Google connus).")
    elif ready and not recs:
        print("ATTENTION — Ready mais pas de resourceRecords (cas limite).")
    else:
        print("Mapping pas encore Ready ou en erreur — voir conditions ci-dessus.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
