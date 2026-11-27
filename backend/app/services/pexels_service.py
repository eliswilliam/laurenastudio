"""
Pexels stock photo search for generated sites (HTTPS hotlinks in HTML, attribution).

API contract matches the reference implementation in ``pexels-api-py`` at repo root
(``pexelsapi/pexels.py``): ``GET https://api.pexels.com/v1/search`` with header
``Authorization: <api_key>``. This module uses ``httpx`` instead of vendoring the package.

Docs: https://www.pexels.com/api/documentation/

Flow: site generation worker enriches the JSON structure *before* ``generate_html`` so Jinja
emits ``<img src="https://images.pexels.com/...">`` (or placehold.co if no key / no result).
"""
from __future__ import annotations

import asyncio
import copy
import logging
import re
from functools import partial
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

PEXELS_SEARCH = "https://api.pexels.com/v1/search"
HTTP_TIMEOUT = 15.0


def placeholder_image_url(label: str, width: int = 1200, height: int = 630) -> str:
    """Neutral placeholder when Pexels is unavailable or returns no results."""
    safe = re.sub(r"[^\w\s-]", "", (label or "Image"))[:40].strip() or "Image"
    safe = quote(safe, safe="")
    return f"https://placehold.co/{width}x{height}/e5e7eb/6b7280?text={safe}"


def _section_to_search_query(sec: dict, site_name: str, brief: str) -> str:
    """
    Build a short search string for Pexels. Prefer model-provided photo_search_query (English).
    """
    custom = (sec.get("photo_search_query") or sec.get("stock_image_keywords") or "").strip()
    if custom:
        return custom[:140]

    parts: list[str] = []
    sn = (site_name or "").strip()
    if sn:
        parts.append(sn)
    h = (sec.get("heading") or "").strip()
    if h:
        parts.append(h)
    sh = (sec.get("subheading") or "").strip()
    if sh:
        parts.append(sh)
    st = (sec.get("type") or "").strip()
    if st and st.lower() not in ("custom", "footer"):
        parts.append(st)

    blob = " ".join(parts)
    words = re.findall(r"[A-Za-zÀ-ÿ0-9]{2,}", blob)
    if len(words) < 2:
        words = re.findall(r"[A-Za-zÀ-ÿ]{3,}", brief or "")[:10]
    if len(words) < 2:
        words = ["business", "professional", "modern"]
    q = " ".join(words[:12])
    out = q[:140].strip() or "business"
    # Hero: bias toward wide editorial photography when the model did not set photo_search_query
    if (sec.get("type") or "").lower() == "hero":
        out = f"{out} wide landscape photography natural light professional"
    return out[:140].strip()


def _search_pexels_first_photo_sync(query: str) -> dict[str, Any] | None:
    """
    Returns dict with keys: url, photographer, photographer_url, pexels_url
    or None on failure / no key / empty results.
    """
    api_key = (settings.PEXELS_API_KEY or "").strip()
    if not api_key:
        logger.debug("PEXELS_API_KEY not set; skipping Pexels search.")
        return None

    q = (query or "").strip()
    if not q:
        return None

    try:
        with httpx.Client(timeout=HTTP_TIMEOUT) as client:
            resp = client.get(
                PEXELS_SEARCH,
                params={"query": q, "per_page": 1, "page": 1},
                headers={"Authorization": api_key},
            )
        if resp.status_code == 429:
            logger.warning("Pexels API rate limited (429) for query=%r", q[:60])
            return None
        if resp.status_code == 401:
            logger.warning("Pexels API unauthorized (401); check PEXELS_API_KEY.")
            return None
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("Pexels HTTP error for query=%r: %s", q[:60], exc)
        return None
    except ValueError as exc:
        logger.warning("Pexels invalid JSON: %s", exc)
        return None

    photos = data.get("photos") or []
    if not photos:
        logger.info("Pexels returned no photos for query=%r", q[:60])
        return None

    p = photos[0]
    src = p.get("src") or {}
    url = src.get("large") or src.get("medium") or src.get("original")
    if not url or not str(url).startswith("https://"):
        return None

    return {
        "url": str(url),
        "photographer": str(p.get("photographer") or "").strip(),
        "photographer_url": str(p.get("photographer_url") or "").strip(),
        "pexels_url": str(p.get("url") or "").strip(),
    }


def _needs_image_replace(url: str) -> bool:
    u = (url or "").strip()
    if not u:
        return True
    low = u.lower()
    if "images.pexels.com" in low or "pexels.com/photos" in low:
        return False
    if "unsplash.com" in low or "pravatar.cc" in low or "placehold.co" in low or "picsum.photos" in low:
        return True
    return False


def _derive_photo_query(obj: dict[str, Any], brief: str, site_name: str) -> str:
    pq = (obj.get("photo_search_query") or obj.get("photo_query") or "").strip()
    if pq:
        return pq[:140]
    parts: list[str] = []
    for key in (
        "cidade",
        "nome",
        "titulo",
        "title",
        "nome",
        "localizacao",
        "marca",
        "label",
        "titulo",
        "category",
    ):
        v = obj.get(key)
        if isinstance(v, str) and v.strip():
            parts.append(v.strip())
    if not parts:
        blob = f"{site_name} {(brief or '')[:120]}"
        words = re.findall(r"[A-Za-zÀ-ÿ]{3,}", blob)[:10]
        parts = words or ["professional", "photography"]
    q = " ".join(parts[:12])
    return (q + " professional photography")[:140].strip()


def _enrich_landing_placeholder_avatars(
    ph: dict[str, Any],
    brief: str,
    site_name: str,
    used_queries: set[str],
) -> None:
    """URLs avatars témoignages (template landing-placeholders)."""
    for i in (1, 2, 3):
        k = f"TESTIMONIAL_{i}_AVATAR"
        v = ph.get(k)
        if not isinstance(v, str) or not _needs_image_replace(v):
            continue
        obj = {
            "photo_search_query": "",
            "nome": ph.get(f"TESTIMONIAL_{i}_NAME"),
            "titulo": ph.get(f"TESTIMONIAL_{i}_ROLE"),
        }
        q = _derive_photo_query(obj, brief, site_name)
        if q in used_queries:
            q = f"{q} portrait"
        used_queries.add(q)
        photo = _search_pexels_first_photo_sync(q)
        label = str(obj.get("nome") or q)[:40]
        if photo:
            ph[k] = photo["url"]
        else:
            ph[k] = placeholder_image_url(label)


def _sync_enrich_site_template(structure: dict, brief: str) -> dict:
    """
    Parcourt `site` (hôtel / e-commerce / portfolio) et remplace les URLs placeholder
    (Unsplash, pravatar, vide) par des liens https Pexels.
    """
    data = copy.deepcopy(structure)
    tid = (data.get("template_id") or "").strip()
    site = data.get("site")
    if not isinstance(site, dict):
        return data

    used_queries: set[str] = set()
    if tid in ("landing-placeholders", "advertising-agency"):
        if tid == "landing-placeholders":
            ph = site.get("placeholders")
            if isinstance(ph, dict):
                sn = str(ph.get("SITE_TITLE") or "Site").strip()
                _enrich_landing_placeholder_avatars(ph, brief, sn, used_queries)
        return data

    meta = site.get("meta")
    if isinstance(meta, dict) and str(meta.get("siteTitle") or "").strip():
        site_name = str(meta.get("siteTitle") or "").strip()
    else:
        site_name = (site.get("nome") or site.get("nom") or "Site").strip()

    def walk(obj: Any) -> None:
        if isinstance(obj, dict):
            pq_parent = (obj.get("photo_search_query") or obj.get("photo_query") or "").strip()
            for k, v in list(obj.items()):
                if k in ("photo_search_query", "photo_query"):
                    continue
                if k in ("imagem", "image", "photo", "avatar") and isinstance(v, str):
                    if not _needs_image_replace(v):
                        continue
                    q = pq_parent or _derive_photo_query(obj, brief, site_name)
                    if q in used_queries:
                        q = f"{q} scene"
                    used_queries.add(q)
                    photo = _search_pexels_first_photo_sync(q)
                    label = (
                        str(
                            obj.get("nome")
                            or obj.get("titulo")
                            or obj.get("title")
                            or obj.get("cidade")
                            or q
                        )[:40]
                    )
                    if photo:
                        obj[k] = photo["url"]
                    else:
                        obj[k] = placeholder_image_url(label)
                elif isinstance(v, (dict, list)):
                    walk(v)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(site)
    return data


def _sync_enrich_structure(structure: dict, brief: str) -> dict:
    """
    For each non-footer section, search Pexels once and set stock_image_* from API results.
    No cap on number of sections. Uses section photo_search_query when present; else derives from content.
    """
    if structure.get("render_mode") == "site_template_v1" or (
        structure.get("template_id") and isinstance(structure.get("site"), dict)
    ):
        return _sync_enrich_site_template(structure, brief)

    data = copy.deepcopy(structure)
    sections = data.get("sections")
    if not isinstance(sections, list):
        return data

    site_name = (data.get("site_name") or "").strip()
    used_queries: set[str] = set()

    for sec in sections:
        if not isinstance(sec, dict):
            continue
        if (sec.get("type") or "").lower() == "footer":
            continue

        q = _section_to_search_query(sec, site_name, brief)
        if q in used_queries:
            q = f"{q} photo"
        used_queries.add(q)

        photo = _search_pexels_first_photo_sync(q)
        label = (sec.get("heading") or q)[:50]
        if photo:
            sec["stock_image_url"] = photo["url"]
            sec["stock_photo_by"] = photo["photographer"]
            sec["stock_photo_by_url"] = photo["photographer_url"]
            sec["stock_photo_page_url"] = photo["pexels_url"]
            sec["stock_image_source"] = "pexels"
        else:
            sec["stock_image_url"] = placeholder_image_url(label)
            sec["stock_photo_by"] = ""
            sec["stock_photo_by_url"] = ""
            sec["stock_photo_page_url"] = ""
            sec["stock_image_source"] = "placeholder"

    return data


async def enrich_site_structure_with_pexels(structure: dict, brief: str) -> dict:
    """Async wrapper around enrichment (runs in thread pool)."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        partial(_sync_enrich_structure, structure, brief),
    )


async def fetch_pexels_urls_for_prompt(
    prompt: str,
    *,
    max_images: int = 6,
) -> list[str]:
    """
    Extract keywords from a user prompt and fetch relevant Pexels image URLs.
    Used by the novidade AI builder to give Gemini real photos for generated sites.
    Returns a list of https://images.pexels.com/... URLs (may be empty if no API key).
    """
    api_key = (settings.PEXELS_API_KEY or "").strip()
    if not api_key:
        return []

    text = (prompt or "").strip()
    if not text:
        return []

    # Build 2-3 search queries from the prompt
    words = re.findall(r"[A-Za-zÀ-ÿ]{3,}", text)
    # De-duplicate while preserving order
    seen: set[str] = set()
    unique_words: list[str] = []
    for w in words:
        lw = w.lower()
        if lw not in seen:
            seen.add(lw)
            unique_words.append(w)

    stop_words = {
        "para", "com", "site", "criar", "quero", "que", "uma", "meu",
        "minha", "and", "the", "for", "with", "that", "this", "from",
        "criar", "preciso", "fazer", "site", "pagina", "web",
    }
    keywords = [w for w in unique_words if w.lower() not in stop_words][:10]

    # Build up to 3 search queries of varying specificity
    queries: list[str] = []
    if len(keywords) >= 4:
        queries.append(" ".join(keywords[:4]))
        queries.append(" ".join(keywords[4:8]) if len(keywords) > 4 else " ".join(keywords[:3]))
    elif keywords:
        queries.append(" ".join(keywords))
    if not queries:
        queries.append(text[:80])

    results: list[str] = []
    seen_urls: set[str] = set()
    loop = asyncio.get_running_loop()

    for query in queries[:3]:
        if len(results) >= max_images:
            break
        try:
            photo = await loop.run_in_executor(
                None,
                partial(_search_pexels_first_photo_sync, query),
            )
            if photo and photo.get("url") and photo["url"] not in seen_urls:
                seen_urls.add(photo["url"])
                results.append(photo["url"])
        except Exception as exc:
            logger.warning("fetch_pexels_urls_for_prompt: query=%r error=%s", query[:60], exc)

    return results


def pexels_api_smoke_check() -> dict[str, Any]:
    """
    One search with a fixed query to verify credentials and API reachability.
    Returns {"ok": bool, "detail": str, "sample_url": str | None}.
    """
    if not (settings.PEXELS_API_KEY or "").strip():
        return {
            "ok": False,
            "detail": "PEXELS_API_KEY is not set",
            "sample_url": None,
        }
    result = _search_pexels_first_photo_sync("nature landscape")
    if result and result.get("url"):
        return {
            "ok": True,
            "detail": "Pexels search returned a photo URL",
            "sample_url": result["url"],
        }
    return {
        "ok": False,
        "detail": "Pexels search returned no photo (check key, quota, or network)",
        "sample_url": None,
    }
