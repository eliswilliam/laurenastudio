"""Helpers pour polices Google et Jinja2."""
from __future__ import annotations

import re

from jinja2 import Environment, BaseLoader


def font_query_name(raw: str | None) -> str:
    """Extrait le nom de police pour l'URL Google Fonts (ex: 'Playfair Display (serif)' -> Playfair+Display)."""
    if not raw:
        return "Inter"
    s = str(raw).strip()
    s = re.split(r"[,(]", s, maxsplit=1)[0].strip()
    return s or "Inter"


def google_fonts_link(*names: str | None) -> str:
    seen: set[str] = set()
    parts: list[str] = []
    for n in names:
        q = font_query_name(n)
        if q.lower() in seen:
            continue
        seen.add(q.lower())
        parts.append(q.replace(" ", "+") + ":wght@400;500;600;700")
    if not parts:
        parts.append("Inter:wght@400;600;700")
    return "https://fonts.googleapis.com/css2?family=" + "&family=".join(parts) + "&display=swap"


jinja_env = Environment(loader=BaseLoader(), autoescape=True)
