"""
Agence publicitaire — HTML figé dans agency_v1.html ; l'IA ne remplit que les placeholders (pas de thème / couleurs).
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

_TEMPLATE_PATH = Path(__file__).resolve().parent / "agency_v1.html"

_CANONICAL_META: dict[str, Any] = {
    "version": "1.0",
    "type": "advertising-agency",
    "description": "Template HTML/CSS agence publicitaire — style brutalist/éditorial, modifiable via placeholders",
    "instructions": (
        "Remplir uniquement les valeurs dans « placeholders » ; le moteur substitue "
        "dans le HTML canonique (couleurs et CSS figés)."
    ),
    "css_variables": {
        "--bg": "Fond principal (beige clair)",
        "--ink": "Couleur principale texte/éléments sombres",
        "--punch": "Couleur accent agressive (rouge vif)",
        "--punch2": "Couleur accent secondaire (jaune)",
        "--soft": "Fond alternatif clair",
        "--muted": "Texte atténué / secondaire",
        "--font-big": "Bebas Neue — titres impactants",
        "--font-ui": "Syne — interface et corps",
        "--font-mono": "Space Mono — labels et tags",
    },
    "sections": [
        "navbar",
        "hero (split layout avec ticker animé)",
        "clients/logos",
        "services (liste interactive)",
        "portfolio (grille éditoriale)",
        "process (étapes numérotées)",
        "cta_band (bande rouge impactante)",
        "footer (4 colonnes)",
    ],
    "design_style": (
        "Brutalist / Editorial — typographie massive Bebas Neue, palette contrastée "
        "noir+rouge+beige, clip-path oblique, ticker animé, badge tournant"
    ),
}

_PLACEHOLDER_RE = re.compile(r"\{\{([A-Z][A-Z0-9_]*)\}\}")

_cached_html: str | None = None
_default_ph: dict[str, str] | None = None


def _load_html() -> str:
    global _cached_html
    if _cached_html is not None:
        return _cached_html
    if not _TEMPLATE_PATH.is_file():
        raise RuntimeError(f"agency_v1.html manquant ({_TEMPLATE_PATH})")
    _cached_html = _TEMPLATE_PATH.read_text(encoding="utf-8")
    return _cached_html


def default_placeholders() -> dict[str, str]:
    global _default_ph
    if _default_ph is not None:
        return dict(_default_ph)
    keys = sorted(set(_PLACEHOLDER_RE.findall(_load_html())))
    _default_ph = {k: "" for k in keys}
    return dict(_default_ph)


def merge_agency_site(site: dict[str, Any]) -> dict[str, Any]:
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


def render_agency_placeholders(site: dict[str, Any]) -> str:
    data = merge_agency_site(site)
    raw = _load_html()
    lang = data.get("lang") or "fr"
    raw = raw.replace('<html lang="fr">', f'<html lang="{html.escape(str(lang), quote=True)}">', 1)
    ph = data["placeholders"]
    for key in sorted(ph.keys(), key=len, reverse=True):
        token = "{{" + key + "}}"
        raw = raw.replace(token, html.escape(str(ph.get(key) or ""), quote=False))
    leftover = _PLACEHOLDER_RE.findall(raw)
    if leftover:
        logger.warning("agency: placeholders non remplis: %s", leftover[:10])
        raw = _PLACEHOLDER_RE.sub("", raw)
    return raw
