"""Helpers pour polices Google et Jinja2."""
from __future__ import annotations

import ast
import json
import re
from typing import Any

from jinja2 import Environment, BaseLoader


def coerce_str_to_mapping(obj: Any) -> Any:
    """
    L'IA ou la chaîne JSON peut parfois produire une *chaîne* qui ressemble à un dict Python
    (ex. "{'label': 'X', 'href': '#', 'primario': True}") au lieu d'un objet. Jinja2 ne
    reconnaît pas ça comme `mapping` et l'affiche en texte brut dans le HTML.
    """
    if isinstance(obj, dict):
        return obj
    if not isinstance(obj, str):
        return obj
    s = obj.strip()
    if not (s.startswith("{") and s.endswith("}")):
        return obj
    try:
        parsed = ast.literal_eval(s)
        if isinstance(parsed, dict):
            return parsed
    except (ValueError, SyntaxError):
        pass
    try:
        parsed = json.loads(s)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    return obj


def coerce_mapping_list(items: Any) -> None:
    """Modifie la liste sur place : chaque élément string-dict devient un dict."""
    if not isinstance(items, list):
        return
    for i, x in enumerate(items):
        items[i] = coerce_str_to_mapping(x)


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
