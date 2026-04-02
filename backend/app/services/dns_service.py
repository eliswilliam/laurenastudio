"""
Cloudflare DNS: map published Cloud Run URLs to `{slug}.{ROOT_DOMAIN}` via proxied CNAME.
Uses Cloudflare REST API v4 (https://api.cloudflare.com/client/v4).
"""
from __future__ import annotations

import logging
import re
from urllib.parse import urlparse

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_CF_API = "https://api.cloudflare.com/client/v4"

_SLUG_RE = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$")


class DnsError(Exception):
    """DNS / Cloudflare failure."""


def dns_configured() -> bool:
    return bool(
        settings.CLOUDFLARE_TOKEN.strip()
        and settings.CLOUDFLARE_ZONE_ID.strip()
        and settings.ROOT_DOMAIN.strip()
    )


def validate_slug(slug: str) -> None:
    """Raise ValueError if slug is invalid (lowercase, digits, hyphens)."""
    s = (slug or "").strip().lower()
    if not s:
        raise ValueError("Slug é obrigatório.")
    if len(s) > 63:
        raise ValueError("Slug demasiado longo (máx. 63 caracteres).")
    if _SLUG_RE.match(s):
        return
    raise ValueError("Use apenas letras minúsculas, números e hífens.")


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.CLOUDFLARE_TOKEN.strip()}",
        "Content-Type": "application/json",
    }


def _cf_error(res: httpx.Response) -> str:
    try:
        data = res.json()
        errs = data.get("errors") or []
        if errs and isinstance(errs, list):
            msg = errs[0].get("message") if isinstance(errs[0], dict) else None
            return msg or res.text[:500]
    except Exception:
        pass
    return res.text[:500]


def _hostname_from_cloud_run_url(cloud_run_url: str) -> str:
    cloud_run_url = (cloud_run_url or "").strip()
    if not cloud_run_url.startswith("http"):
        cloud_run_url = f"https://{cloud_run_url}"
    p = urlparse(cloud_run_url)
    host = (p.netloc or "").strip().lower()
    if not host:
        raise DnsError("URL do Cloud Run inválida.")
    return host.rstrip(".")


def _list_cname_for_slug(
    zone_id: str,
    fqdn: str,
    slug: str,
) -> list[dict]:
    """Return DNS records matching name and type CNAME (try FQDN then subdomain label)."""
    url = f"{_CF_API}/zones/{zone_id}/dns_records"
    for name in (fqdn, slug):
        params = {"type": "CNAME", "name": name}
        with httpx.Client(timeout=60.0) as client:
            r = client.get(url, headers=_headers(), params=params)
        if r.status_code != 200:
            raise DnsError(f"Cloudflare list DNS: {_cf_error(r)}")
        data = r.json()
        if not data.get("success"):
            raise DnsError(f"Cloudflare list DNS: {_cf_error(r)}")
        out = list(data.get("result") or [])
        if out:
            return out
    return []


def create_subdomain(slug: str, cloud_run_url: str) -> str:
    """
    Create or update a proxied CNAME: slug → Cloud Run hostname.
    Returns final public URL https://{slug}.{ROOT_DOMAIN}

    Note: HTTPS to that host may still 404 until a Cloud Run **domain mapping**
    exists for this hostname and service (GCP Console or gcloud). DNS alone is not enough.
    """
    if not dns_configured():
        raise DnsError("Cloudflare não está configurado (CLOUDFLARE_TOKEN, CLOUDFLARE_ZONE_ID, ROOT_DOMAIN).")

    validate_slug(slug)
    root = settings.ROOT_DOMAIN.strip().lower().rstrip(".")
    if not root:
        raise DnsError("ROOT_DOMAIN não está definido.")

    zone_id = settings.CLOUDFLARE_ZONE_ID.strip()
    target = _hostname_from_cloud_run_url(cloud_run_url)
    fqdn = f"{slug}.{root}"

    body = {
        "type": "CNAME",
        "name": slug,
        "content": target,
        "proxied": True,
        "ttl": 1,
    }

    existing = _list_cname_for_slug(zone_id, fqdn, slug)
    url = f"{_CF_API}/zones/{zone_id}/dns_records"

    with httpx.Client(timeout=60.0) as client:
        if existing:
            rid = existing[0].get("id")
            if not rid:
                raise DnsError("Registo DNS existente sem ID.")
            r = client.patch(url + f"/{rid}", headers=_headers(), json=body)
        else:
            r = client.post(url, headers=_headers(), json=body)

    if r.status_code not in (200, 201):
        raise DnsError(f"Cloudflare DNS: {_cf_error(r)}")

    data = r.json()
    if not data.get("success"):
        raise DnsError(f"Cloudflare DNS: {_cf_error(r)}")

    final = f"https://{fqdn}"
    logger.info("DNS CNAME %s → %s (proxied). URL=%s", fqdn, target, final)
    return final


def _delete_dns_records_for_names(zone_id: str, names: set[str]) -> None:
    """Supprime tous les enregistrements DNS Cloudflare pour ces noms (tous types)."""
    url = f"{_CF_API}/zones/{zone_id}/dns_records"
    with httpx.Client(timeout=60.0) as client:
        for name in names:
            if not name:
                continue
            r = client.get(url, headers=_headers(), params={"name": name})
            if r.status_code != 200:
                raise DnsError(f"Cloudflare list DNS (delete): {_cf_error(r)}")
            data = r.json()
            if not data.get("success"):
                raise DnsError(f"Cloudflare list DNS (delete): {_cf_error(r)}")
            for rec in data.get("result") or []:
                rid = rec.get("id")
                if rid:
                    dr = client.delete(f"{url}/{rid}", headers=_headers())
                    if dr.status_code not in (200, 404):
                        raise DnsError(f"Cloudflare delete DNS: {_cf_error(dr)}")


def _normalize_rrdata(rrdata: str) -> str:
    s = (rrdata or "").strip()
    if s.endswith("."):
        s = s[:-1]
    return s


def _cloudflare_name_from_google_record(
    gname: str,
    *,
    root: str,
    slug: str,
    fqdn: str,
) -> str:
    """
    Google renvoie souvent le FQDN complet (ex. _acme-challenge.slug.root).
    Cloudflare attend le nom relatif à la zone (ex. slug ou _acme-challenge.slug).
    """
    g = (gname or "").strip().rstrip(".").lower()
    r = root.strip().lower().rstrip(".")
    f = fqdn.strip().lower().rstrip(".")
    if not g:
        return slug
    if g == f:
        return slug
    suffix = f".{r}"
    if g.endswith(suffix):
        left = g[: -len(suffix)]
        return left if left else slug
    # Nom relatif sans suffixe de zone (ex. _acme-challenge.slug) — on repasse tel quel à Cloudflare
    return g if g else slug


def apply_google_resource_records_to_cloudflare(
    slug: str,
    root: str,
    records: list[dict],
) -> None:
    """
    Applique les ResourceRecord renvoyés par le domain mapping Cloud Run dans la zone Cloudflare.
    Supprime d'abord les anciens enregistrements (ex. CNAME vers *.run.app).
    """
    if not dns_configured():
        raise DnsError("Cloudflare não está configurado.")
    zone_id = settings.CLOUDFLARE_ZONE_ID.strip()
    root_norm = root.strip().lower().rstrip(".")
    fqdn = f"{slug}.{root_norm}"
    acme = f"_acme-challenge.{slug}"
    acme_fqdn = f"_acme-challenge.{fqdn}"
    _delete_dns_records_for_names(zone_id, {fqdn, slug, acme, acme_fqdn})

    url = f"{_CF_API}/zones/{zone_id}/dns_records"
    for rec in records:
        raw_type = rec.get("type")
        if isinstance(raw_type, int):
            type_map = {1: "A", 2: "AAAA", 5: "CNAME", 16: "TXT"}
            rtype = type_map.get(raw_type, "")
        else:
            rtype = str(raw_type or "").upper()
            if "CNAME" in rtype:
                rtype = "CNAME"
            elif rtype == "A":
                rtype = "A"
            elif rtype == "AAAA":
                rtype = "AAAA"
            elif "TXT" in rtype:
                rtype = "TXT"
            else:
                rtype = ""

        if rtype not in ("A", "AAAA", "CNAME", "TXT"):
            logger.warning("Tipo DNS Google não suportado (ignorado): %s", raw_type)
            continue

        raw_rr = str(rec.get("rrdata") or "")
        if rtype == "TXT":
            rrdata = raw_rr.strip()
        else:
            rrdata = _normalize_rrdata(raw_rr)
        if not rrdata:
            continue

        gname = (rec.get("name") or "").strip()
        cf_name = _cloudflare_name_from_google_record(
            gname, root=root, slug=slug, fqdn=fqdn
        )

        body: dict = {
            "type": rtype,
            "name": cf_name,
            "content": rrdata,
            "ttl": 1,
            # Toujours DNS only pour les enregistrements Google (domain mapping).
            # proxied=True (nuage orange) → Cloudflare tente un TLS vers l’origine (ghs.googlehosted.com /
            # IPs Google) et échoue souvent avec **525 SSL handshake failed** (SNI / cert incompatible).
            # En direct, le client résout le DNS et négocie le TLS avec Google comme prévu.
            "proxied": False,
        }
        with httpx.Client(timeout=60.0) as client:
            r = client.post(url, headers=_headers(), json=body)
        if r.status_code not in (200, 201):
            raise DnsError(f"Cloudflare create DNS ({rtype}): {_cf_error(r)}")
        data = r.json()
        if not data.get("success"):
            raise DnsError(f"Cloudflare create DNS ({rtype}): {_cf_error(r)}")
        logger.info(
            "Cloudflare DNS %s %s → %s (proxied=%s)",
            rtype,
            cf_name,
            rrdata,
            body.get("proxied"),
        )


def delete_subdomain_records(slug: str) -> None:
    """Delete Cloudflare DNS records for slug and ACME variants under ROOT_DOMAIN."""
    if not dns_configured():
        return

    validate_slug(slug)
    zone_id = settings.CLOUDFLARE_ZONE_ID.strip()
    root = settings.ROOT_DOMAIN.strip().lower().rstrip(".")
    if not zone_id or not root:
        return

    fqdn = f"{slug}.{root}"
    acme = f"_acme-challenge.{slug}"
    acme_fqdn = f"_acme-challenge.{fqdn}"
    _delete_dns_records_for_names(zone_id, {fqdn, slug, acme, acme_fqdn})
