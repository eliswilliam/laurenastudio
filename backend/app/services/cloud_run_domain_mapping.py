"""
Cloud Run Domain Mapping (API domains.cloudrun.com/v1) + Cloudflare DNS.

Après déploiement, Google exige un **domain mapping** pour accepter le Host `slug.domaine`.
Le simple CNAME vers `*.run.app` ne suffit pas.

Flux:
1. POST sur l'hôte **régional** `https://{region}-run.googleapis.com/apis/domains.cloudrun.com/v1/...`
   (l'hôte global `run.googleapis.com` renvoie 404 sur POST pour ce groupe d'API.)
2. Poll GET jusqu'à `resourceRecords` puis jusqu'à condition Ready
3. Appliquer les enregistrements retournés par Google dans Cloudflare (remplace un vieux CNAME vers run.app)
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import settings
from app.services.cloud_run_lookup import get_gcp_access_token
from app.services.github_publish_service import decode_gcp_sa_key
from app.services.dns_service import (
    DnsError,
    apply_google_resource_records_to_cloudflare,
    dns_configured,
    validate_slug,
)

logger = logging.getLogger(__name__)


def _dm_api_base(region: str) -> str:
    """Base API domain mappings (obligatoire : endpoint régional, pas run.googleapis.com seul)."""
    r = (region or "us-central1").strip()
    return f"https://{r}-run.googleapis.com/apis/domains.cloudrun.com/v1"


class DomainMappingError(Exception):
    """Erreur API domain mapping GCP."""


def _dm_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _get_domain_mapping(project_id: str, domain_fqdn: str, region: str) -> dict[str, Any]:
    token = get_gcp_access_token()
    enc = quote(domain_fqdn, safe="")
    url = f"{_dm_api_base(region)}/namespaces/{project_id}/domainmappings/{enc}"
    with httpx.Client(timeout=120.0) as client:
        r = client.get(url, headers=_dm_headers(token))
    if r.status_code == 404:
        return {}
    if r.status_code != 200:
        raise DomainMappingError(f"GET domain mapping {r.status_code}: {r.text[:800]}")
    return r.json()


def _create_domain_mapping(
    project_id: str,
    region: str,
    service_name: str,
    domain_fqdn: str,
) -> dict[str, Any]:
    token = get_gcp_access_token()
    url = f"{_dm_api_base(region)}/namespaces/{project_id}/domainmappings"
    body: dict[str, Any] = {
        "apiVersion": "domains.cloudrun.com/v1",
        "kind": "DomainMapping",
        "metadata": {
            "name": domain_fqdn,
            "namespace": project_id,
            "labels": {
                "cloud.googleapis.com/location": region,
            },
        },
        "spec": {
            "routeName": service_name,
            "certificateMode": "AUTOMATIC",
        },
    }
    with httpx.Client(timeout=120.0) as client:
        r = client.post(url, headers=_dm_headers(token), json=body)
    if r.status_code in (200, 201):
        return r.json()
    if r.status_code == 409:
        logger.info("Domain mapping already exists for %s, fetching…", domain_fqdn)
        return _get_domain_mapping(project_id, domain_fqdn, region)
    raise DomainMappingError(f"POST domain mapping {r.status_code}: {r.text[:1200]}")


def _fatal_domain_mapping_message(dm: dict[str, Any]) -> str | None:
    """
    Si le statut du mapping indique une erreur définitive (ex. PermissionDenied),
    retourne le message Google pour ne pas attendre inutilement des resourceRecords.
    """
    status = dm.get("status") or {}
    for c in status.get("conditions") or []:
        st = (c.get("status") or "").lower()
        if st and st != "false":
            continue
        reason = (c.get("reason") or "").strip()
        msg = (c.get("message") or "").strip()
        if reason.lower() == "permissiondenied" and msg:
            return msg
        if "not authorized to administer the domain" in msg.lower():
            return msg
        if reason.lower() in ("permanent", "failed") and msg:
            return msg
    return None


def _raise_if_fatal_domain_mapping(dm: dict[str, Any]) -> None:
    msg = _fatal_domain_mapping_message(dm)
    if not msg:
        return
    sa_email = ""
    try:
        raw = decode_gcp_sa_key(settings.GCP_SA_KEY)
        sa_email = (json.loads(raw).get("client_email") or "").strip()
    except Exception:
        pass
    suffix = f" (GCP_SA_KEY / caller: {sa_email})" if sa_email else ""
    stale_hint = ""
    if "not authorized to administer the domain" in msg.lower() or "permissiondenied" in msg.lower():
        stale_hint = (
            " — Si ce compte est déjà propriétaire dans Search Console, supprimez ce domain mapping "
            "(Cloud Run → Domain mappings) puis republiez : un mapping créé avant la vérif peut rester "
            "en PermissionDenied jusqu’à recréation."
        )
    raise DomainMappingError(f"Domain mapping GCP: {msg[:4000]}{suffix}{stale_hint}")


def _status_ready(dm: dict[str, Any]) -> bool:
    status = dm.get("status") or {}
    for c in status.get("conditions") or []:
        if (c.get("type") or "").lower() == "ready":
            st = (c.get("status") or "").lower()
            if st == "true":
                return True
            if st == "false" and (c.get("reason") or "").lower() in ("permanent", "failed"):
                return False
    return False


def _status_message(dm: dict[str, Any]) -> str:
    status = dm.get("status") or {}
    for c in status.get("conditions") or []:
        if (c.get("type") or "").lower() == "ready":
            return (c.get("message") or c.get("reason") or "")[:500]
    return ""


def ensure_mapped_domain_and_cloudflare_dns(
    slug: str,
    *,
    service_name: str,
) -> str:
    """
    Crée le domain mapping GCP pour `slug.ROOT_DOMAIN`, applique les DNS Google dans Cloudflare.
    Retourne l'URL canonique https://slug.domain
    """
    if not dns_configured():
        raise DnsError("Cloudflare não está configurado.")
    if not settings.GCP_SA_KEY.strip():
        raise DnsError(
            "GCP_SA_KEY é necessário na API para criar o domain mapping no Cloud Run (automação DNS)."
        )
    project_id = settings.GCP_PROJECT_ID.strip()
    region = (settings.GCP_REGION or "us-central1").strip()
    if not project_id:
        raise DnsError("GCP_PROJECT_ID não está definido.")

    validate_slug(slug)
    root = settings.ROOT_DOMAIN.strip().lower().rstrip(".")
    fqdn = f"{slug}.{root}"
    final = f"https://{fqdn}"

    dm = _create_domain_mapping(project_id, region, service_name, fqdn)
    if not dm:
        dm = _get_domain_mapping(project_id, fqdn, region)
    if not dm:
        raise DomainMappingError("Domain mapping vazio após create.")

    _raise_if_fatal_domain_mapping(dm)

    interval = settings.GCP_DOMAIN_MAPPING_POLL_INTERVAL_SECONDS
    deadline_records = time.monotonic() + min(420, settings.GCP_DOMAIN_MAPPING_POLL_MAX_SECONDS)
    applied = False
    last_log_records = time.monotonic()

    def _records(dm_obj: dict[str, Any]) -> list[dict]:
        return list((dm_obj.get("status") or {}).get("resourceRecords") or [])

    # 1) resourceRecords puis Cloudflare
    while time.monotonic() < deadline_records:
        _raise_if_fatal_domain_mapping(dm)
        now = time.monotonic()
        if now - last_log_records >= 30.0:
            logger.info(
                "[publish] waiting for GCP resourceRecords %s (~%ds left in this phase)",
                fqdn,
                int(deadline_records - now),
            )
            last_log_records = now
        recs = _records(dm)
        if recs and not applied:
            logger.info("Applying %s Google DNS records to Cloudflare for %s", len(recs), fqdn)
            apply_google_resource_records_to_cloudflare(slug, root, recs)
            applied = True
            break
        if _status_ready(dm) and not _records(dm):
            logger.warning("Domain mapping Ready sem resourceRecords (cas limite) para %s", fqdn)
            return final
        time.sleep(interval)
        dm = _get_domain_mapping(project_id, fqdn, region)
        if not dm:
            raise DomainMappingError("Domain mapping desapareceu durante o poll (records).")

    if not applied:
        raise DomainMappingError(
            "Google não devolveu resourceRecords para o domain mapping a tempo. "
            "Verifique IAM (run.domainmappings.*) e a consola Cloud Run → Domain mappings."
        )

    # 2) Ready (certificado / propagation) — fenêtre dédiée
    deadline_ready = time.monotonic() + settings.GCP_DOMAIN_MAPPING_POLL_MAX_SECONDS
    last_log_ready = time.monotonic()
    while time.monotonic() < deadline_ready:
        dm = _get_domain_mapping(project_id, fqdn, region)
        _raise_if_fatal_domain_mapping(dm)
        now = time.monotonic()
        if now - last_log_ready >= 30.0:
            logger.info(
                "[publish] waiting for domain mapping Ready %s (~%ds left)",
                fqdn,
                int(deadline_ready - now),
            )
            last_log_ready = now
        if _status_ready(dm):
            logger.info("Domain mapping Ready for %s", fqdn)
            return final
        time.sleep(interval)

    msg = _status_message(dm or {})
    raise DomainMappingError(
        f"Domain mapping não ficou Ready após aplicar DNS ({settings.GCP_DOMAIN_MAPPING_POLL_MAX_SECONDS}s). "
        f"Último estado: {msg or 'sem mensagem'}"
    )
