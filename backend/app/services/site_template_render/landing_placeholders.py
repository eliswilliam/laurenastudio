"""
Landing single-page : HTML figé dans landing_v1.html ; l'IA ne remplit que les placeholders
(couleurs et thème CSS figés dans le fichier — pas de surcharge).
"""
from __future__ import annotations

import html
import json
import logging
import re
from copy import deepcopy
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_TEMPLATE_PATH = Path(__file__).resolve().parent / "landing_v1.html"

_CANONICAL_META: dict[str, Any] = {
    "version": "1.0",
    "description": "Template HTML/CSS single-page — modifiable par IA via les placeholders",
    "instructions": (
        "Remplir uniquement les clés « placeholders » ; le HTML et les couleurs du thème "
        "sont figés dans le moteur."
    ),
    "css_variables": {
        "--color-bg": "Couleur de fond principale (fixe dans le gabarit)",
        "--color-surface": "Couleur de fond des sections secondaires (fixe)",
        "--color-border": "Couleur des bordures (fixe)",
        "--color-accent": "Couleur accent principale (fixe)",
        "--color-accent2": "Couleur accent secondaire (fixe)",
        "--color-text": "Couleur du texte principal (fixe)",
        "--color-muted": "Couleur du texte atténué (fixe)",
        "--font-display": "Police titres (fixe dans le CSS du gabarit)",
        "--font-body": "Police corps (fixe dans le CSS du gabarit)",
    },
    "sections": [
        "navbar",
        "hero",
        "features",
        "stats",
        "testimonials",
        "cta",
        "footer",
    ],
}

_PLACEHOLDER_RE = re.compile(r"\{\{([A-Z][A-Z0-9_]*)\}\}")

_cached_template_html: str | None = None
_default_placeholders: dict[str, str] | None = None


def _load_template_html() -> str:
    global _cached_template_html
    if _cached_template_html is not None:
        return _cached_template_html
    if not _TEMPLATE_PATH.is_file():
        raise RuntimeError(
            f"landing_v1.html introuvable ({_TEMPLATE_PATH}). "
            "Ce fichier doit accompagner landing_placeholders.py."
        )
    _cached_template_html = _TEMPLATE_PATH.read_text(encoding="utf-8")
    return _cached_template_html


def default_placeholders() -> dict[str, str]:
    """Toutes les clés présentes dans le HTML canonique, valeurs vides."""
    global _default_placeholders
    if _default_placeholders is not None:
        return dict(_default_placeholders)
    keys = sorted(set(_PLACEHOLDER_RE.findall(_load_template_html())))
    _default_placeholders = {k: "" for k in keys}
    return dict(_default_placeholders)


def merge_landing_site(site: dict[str, Any]) -> dict[str, Any]:
    """
    Fusionne la sortie IA : pas de html_template, pas de theme — uniquement placeholders + lang.
    """
    raw = deepcopy(site) if site else {}
    raw.pop("html_template", None)

    out: dict[str, Any] = {}

    base = default_placeholders()
    ai_ph = raw.get("placeholders")
    if not isinstance(ai_ph, dict):
        ai_ph = {}
    merged = dict(base)
    for key in base:
        if key not in ai_ph:
            continue
        val = ai_ph[key]
        if val is None:
            merged[key] = ""
        elif isinstance(val, (str, int, float)):
            merged[key] = str(val)
        else:
            merged[key] = json.dumps(val, ensure_ascii=False)
    out["placeholders"] = merged

    out["meta"] = deepcopy(_CANONICAL_META)

    lang = raw.get("lang")
    if not isinstance(lang, str) or not lang.strip():
        out["lang"] = "fr"
    else:
        out["lang"] = lang.strip()[:12]

    return out


def render_landing_placeholders(site: dict[str, Any]) -> str:
    data = merge_landing_site(site)
    raw = _load_template_html()
    lang = data.get("lang") or "fr"
    raw = raw.replace('<html lang="fr">', f'<html lang="{html.escape(str(lang), quote=True)}">', 1)
    ph = data["placeholders"]
    for key in sorted(ph.keys(), key=len, reverse=True):
        token = "{{" + key + "}}"
        raw = raw.replace(token, html.escape(str(ph.get(key) or ""), quote=False))
    leftover = _PLACEHOLDER_RE.findall(raw)
    if leftover:
        logger.warning("landing: placeholders non remplis: %s", leftover[:10])
        raw = _PLACEHOLDER_RE.sub("", raw)
    return raw
