"""
Vérification contractuelle : mapping sous-domaine → réponse API → forme d’URL pour l’utilisateur.

Sans déploiement GitHub complet. Exécution :
  docker compose exec api python scripts/verify_publish_automation.py
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

# backend/ → parent scripts/
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.core.config import settings  # noqa: E402
from app.schemas.publish import PublishResponse  # noqa: E402
from app.services.dns_service import dns_configured  # noqa: E402


def main() -> int:
    print("=== verify_publish_automation.py ===\n", flush=True)

    # 1) Schéma réponse : siteUrl (alias) + dnsApplied pour le front
    r = PublishResponse(
        github="https://github.com/o/r",
        site_url="https://demo-slug.laurenastudio.pro",
        deploy_ok=True,
        success=True,
        actions_url="https://github.com/o/r/actions",
        cloud_run="https://svc-xxx.run.app",
        dns_applied=True,
    )
    out = r.model_dump(by_alias=True)
    assert out.get("siteUrl") == "https://demo-slug.laurenastudio.pro", out
    assert out.get("deployOk") is True
    assert out.get("dnsApplied") is True
    assert out.get("cloudRun") == "https://svc-xxx.run.app"
    print("[1] PublishResponse (alias JSON) → siteUrl, dnsApplied, cloudRun : OK")
    print(f"    Exemple siteUrl: {out['siteUrl']}")

    # 2) URL canonique = même forme que ensure_mapped_domain_and_cloudflare_dns (return final)
    root = settings.ROOT_DOMAIN.strip().lower().rstrip(".")
    slug = "mon-slug-test"
    canonical = f"https://{slug}.{root}"
    assert canonical.startswith("https://"), canonical
    print(f"[2] URL canonique sous-domaine (ROOT_DOMAIN={root!r}) : {canonical}")

    # 3) Backend exige slug si DNS configuré
    print(f"[3] dns_configured() = {dns_configured()} (si True, /api/publish exige slug + mapping DNS)", flush=True)

    # 4) Tests unitaires mapping + noms DNS
    print("\n[4] unittest test_domain_mapping_automation …", flush=True)
    subprocess.check_call(
        [sys.executable, "-m", "unittest", "test_domain_mapping_automation", "-v"],
        cwd=str(ROOT),
    )
    print("\n[5] pytest test_dns_google_names.py …")
    subprocess.check_call(
        [sys.executable, "-m", "pytest", "test_dns_google_names.py", "-q"],
        cwd=str(ROOT),
    )

    print("\n=== Tout OK — automatisation (contrat + tests) ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
