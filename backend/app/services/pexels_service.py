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
    Build a short search string for Pexels from section + site context (no Gemini field).
    """
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
    return q[:140].strip() or "business"


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


def _sync_enrich_structure(structure: dict, brief: str) -> dict:
    """
    For each non-footer section, search Pexels once and set stock_image_* from API results.
    No cap on number of sections. No Gemini photo_search_query — queries derived from content.
    """
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
