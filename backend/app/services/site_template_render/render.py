"""Point d'entrée : choisit le rendu selon `template_id`."""
from __future__ import annotations

from typing import Any

from app.services.site_template_render.ecommerce import render_ecommerce
from app.services.site_template_render.hotel import render_hotel
from app.services.site_template_render.agency_placeholders import render_agency_placeholders
from app.services.site_template_render.landing_placeholders import render_landing_placeholders
from app.services.site_template_render.portfolio import render_portfolio

_TEMPLATE_IDS = frozenset(
    {
        "hotel-reserva",
        "ecommerce",
        "portfolio",
        "landing-placeholders",
        "advertising-agency",
    }
)


def render_site_template_html(structure: dict[str, Any]) -> str:
    tid = (structure.get("template_id") or "").strip()
    site = structure.get("site")
    if not isinstance(site, dict):
        raise ValueError("site_template: missing site object")
    if tid == "hotel-reserva":
        return render_hotel(site)
    if tid == "ecommerce":
        return render_ecommerce(site)
    if tid == "portfolio":
        return render_portfolio(site)
    if tid == "landing-placeholders":
        return render_landing_placeholders(site)
    if tid == "advertising-agency":
        return render_agency_placeholders(site)
    raise ValueError(f"site_template: unknown template_id {tid!r}")


def is_site_template_structure(structure: dict[str, Any]) -> bool:
    tid = (structure.get("template_id") or "").strip()
    return tid in _TEMPLATE_IDS and isinstance(structure.get("site"), dict)
