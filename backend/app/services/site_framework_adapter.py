"""
Convertit la sortie JSON « framework » (projectInfo + page.blocks) vers le format interne
utilisé par site_generator (sections + meta). Rétrocompatible si la clé `sections` existe déjà.
"""
from __future__ import annotations

import re
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Lines that are only an image URL (model sometimes puts Pexels/Unsplash in testimonial text).
_STANDALONE_IMG_URL = re.compile(
    r"^https?://[^\s]+\.(?:jpe?g|png|webp|gif)(?:\?[^\s]*)?\s*$",
    re.IGNORECASE,
)
_PEXELS_UNSPLASH_LINE = re.compile(
    r"^https?://images\.(?:pexels|unsplash)\.com/\S+\s*$",
    re.IGNORECASE,
)


def _strip_standalone_image_urls_from_text(text: str) -> tuple[str, str]:
    """Remove URL-only lines from testimonial copy; return (cleaned_text, first_url_found)."""
    if not text or not isinstance(text, str):
        return (str(text).strip() if text else ""), ""
    first_url = ""
    kept: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        if _PEXELS_UNSPLASH_LINE.match(s) or _STANDALONE_IMG_URL.match(s):
            if not first_url:
                first_url = s
            continue
        kept.append(line)
    cleaned = "\n".join(kept).strip()
    return cleaned, first_url


def _normalize_hotel_testimonial_avatars(site: dict[str, Any]) -> None:
    """Move image URLs erroneously placed in depoimento.texto into avatar; fixes naked URLs in quotes."""
    secoes = site.get("secoes")
    if not isinstance(secoes, list):
        return
    for sec in secoes:
        if not isinstance(sec, dict):
            continue
        if str(sec.get("tipo") or "").strip() != "testimonials":
            continue
        deps = sec.get("depoimentos")
        if not isinstance(deps, list):
            continue
        for t in deps:
            if not isinstance(t, dict):
                continue
            texto = str(t.get("texto") or "")
            avatar = str(t.get("avatar") or "").strip()
            cleaned, url = _strip_standalone_image_urls_from_text(texto)
            if url and not avatar:
                t["avatar"] = url
            if cleaned != texto:
                t["texto"] = cleaned


# Tailwind / noms de couleur → hex (couleurs fréquentes)
_PRIMARY_NAME_TO_HEX: dict[str, str] = {
    "blue-600": "#2563eb",
    "blue-500": "#3b82f6",
    "indigo-600": "#4f46e5",
    "violet-600": "#7c3aed",
    "purple-600": "#9333ea",
    "fuchsia-600": "#c026d3",
    "rose-600": "#e11d48",
    "red-600": "#dc2626",
    "orange-600": "#ea580c",
    "amber-600": "#d97706",
    "emerald-600": "#059669",
    "teal-600": "#0d9488",
    "cyan-600": "#0891b2",
    "sky-600": "#0284c7",
    "slate-600": "#475569",
    "gray-600": "#4b5563",
    "zinc-600": "#52525b",
    "stone-600": "#57534e",
    "neutral-600": "#525252",
    "black": "#111827",
}


def parse_primary_color(raw: str | None) -> str:
    s = (raw or "").strip()
    if re.match(r"^#[0-9A-Fa-f]{6}$", s):
        return s
    if re.match(r"^#[0-9A-Fa-f]{3}$", s):
        # #RGB → #RRGGBB
        return "#" + "".join(c * 2 for c in s[1:])
    key = s.lower().replace(" ", "")
    return _PRIMARY_NAME_TO_HEX.get(key, "#6366f1")


def _bg_framework_to_section(bg: str | None) -> str:
    """Map design.background du framework vers background du template."""
    if not bg:
        return "light"
    b = str(bg).lower()
    if "dark" in b or "slate" in b:
        return "dark"
    if "gradient" in b:
        return "gradient"
    if "primary" in b:
        return "primary"
    return "light"


def _split_headline(headline: str, highlight: str | None) -> tuple[str, str, str]:
    h = (headline or "").strip()
    hi = (highlight or "").strip()
    if not hi or hi not in h:
        return h, "", ""
    i = h.index(hi)
    return h[:i], hi, h[i + len(hi) :]


def framework_to_legacy(structure: dict) -> dict:
    """Transforme projectInfo + page.blocks → site_name, sections, nav_bar, etc."""
    pi = structure.get("projectInfo") or {}
    page = structure.get("page") or {}
    blocks = page.get("blocks")
    if not isinstance(blocks, list) or not blocks:
        raise ValueError("framework: page.blocks must be a non-empty array")

    theme = pi.get("theme") or {}
    site_name = (pi.get("name") or "Site").strip() or "Site"
    font = (theme.get("font") or "Inter").strip() or "Inter"
    primary_color = parse_primary_color(theme.get("primaryColor"))
    lang = (pi.get("language") or "pt").strip()[:5] or "pt"
    page_title = (page.get("title") or site_name).strip()
    description = page_title[:160]

    nav_bar: dict[str, Any] | None = None
    sections: list[dict[str, Any]] = []

    for block in blocks:
        if not isinstance(block, dict):
            continue
        btype = (block.get("type") or "").strip()
        bid = (block.get("id") or "").strip() or f"block-{len(sections)}"
        content = block.get("content") if isinstance(block.get("content"), dict) else {}
        design = block.get("design") if isinstance(block.get("design"), dict) else {}
        photo_q = (block.get("photo_search_query") or "").strip()

        if btype == "NavbarBlock":
            logo = content.get("logo") or {}
            links_raw = content.get("links") or []
            links_out: list[dict[str, str]] = []
            if isinstance(links_raw, list):
                for ln in links_raw[:8]:
                    if not isinstance(ln, dict):
                        continue
                    links_out.append(
                        {
                            "label": str(ln.get("label") or "").strip() or "Link",
                            "href": str(ln.get("href") or "#").strip() or "#",
                        }
                    )
            cta = content.get("callToAction") or {}
            nav_bar = {
                "logo_text": str(logo.get("text") or site_name).strip() or site_name,
                "logo_letter": str(logo.get("iconLetter") or site_name[:1] or "L").strip()[:3],
                "links": links_out,
                "cta_label": str(cta.get("label") or "").strip(),
                "cta_href": str(cta.get("href") or "#").strip() or "#",
            }
            continue

        if btype == "HeroBlock":
            buttons = content.get("buttons") or []
            btn_primary = buttons[0] if isinstance(buttons, list) and len(buttons) > 0 else {}
            btn_secondary = buttons[1] if isinstance(buttons, list) and len(buttons) > 1 else {}
            h1 = str(content.get("headline") or "Welcome").strip()
            hi = str(content.get("headlineHighlight") or "").strip()
            p1, mid, p3 = _split_headline(h1, hi)
            _align = str(design.get("alignment") or "center").lower()
            hero_align = "left" if "left" in _align else "center"
            sec: dict[str, Any] = {
                "type": "hero",
                "section_id": bid,
                "nav_label": str(content.get("nav_label") or "Início")[:24] or "Início",
                "heading": h1,
                "heading_part1": p1,
                "heading_highlight": mid,
                "heading_part3": p3,
                "hero_text_align": hero_align,
                "badge": str(content.get("badge") or "").strip(),
                "subheading": str(
                    content.get("subheading") or content.get("subheadline") or ""
                ).strip(),
                "cta_text": str(btn_primary.get("label") or "").strip(),
                "cta_url": str(btn_primary.get("href") or "#").strip() or "#",
                "cta_text_secondary": str(btn_secondary.get("label") or "").strip(),
                "cta_url_secondary": str(btn_secondary.get("href") or "#").strip() or "#",
                "background": _bg_framework_to_section(design.get("background")),
                "photo_search_query": photo_q
                or f"{h1} hero banner professional wide photography",
            }
            sections.append(sec)
            continue

        if btype == "FeaturesGridBlock":
            items_in = content.get("items") or []
            items_out: list[dict[str, str]] = []
            if isinstance(items_in, list):
                for it in items_in:
                    if not isinstance(it, dict):
                        continue
                    title = str(it.get("title") or "").strip()
                    desc = str(it.get("description") or "").strip()
                    metric = str(it.get("metric") or "").strip()
                    ml = str(it.get("metricLabel") or "").strip()
                    extra = f" {metric} {ml}".strip() if metric or ml else ""
                    text = (desc + (" · " + extra if extra else "")).strip()
                    items_out.append(
                        {
                            "title": title or "—",
                            "text": text or "—",
                            "icon": str(it.get("icon") or "").strip(),
                        }
                    )
            sec = {
                "type": "features",
                "section_id": bid,
                "nav_label": str(content.get("nav_label") or content.get("sectionTitle") or "Features")[
                    :24
                ],
                "heading": str(content.get("sectionTitle") or "Features").strip() or "Features",
                "subheading": str(content.get("sectionSubtitle") or "").strip(),
                "items": items_out,
                "background": "light",
                "photo_search_query": photo_q,
            }
            sections.append(sec)
            continue

        if btype == "CallToActionBlock":
            actions = content.get("actions") or []
            act0 = actions[0] if isinstance(actions, list) and actions else {}
            sec = {
                "type": "cta",
                "section_id": bid,
                "nav_label": "",
                "heading": str(content.get("heading") or "Pronto?").strip(),
                "subheading": str(content.get("description") or "").strip(),
                "cta_text": str(act0.get("label") or "").strip(),
                "cta_url": str(act0.get("href") or "#").strip() or "#",
                "background": _bg_framework_to_section(design.get("background")),
                "photo_search_query": photo_q,
            }
            st = content.get("secondaryTextLink")
            if isinstance(st, dict) and (st.get("linkLabel") or st.get("href")):
                sec["cta_secondary_note"] = str(st.get("text") or "").strip()
                sec["cta_secondary_label"] = str(st.get("linkLabel") or "").strip()
                sec["cta_secondary_url"] = str(st.get("href") or "#").strip() or "#"
            sections.append(sec)
            continue

        if btype == "FooterBlock":
            brand = content.get("brand") or {}
            menus = content.get("menus") or []
            sec = {
                "type": "footer",
                "section_id": bid or "footer",
                "nav_label": str(content.get("nav_label") or "Info")[:20] or "Info",
                "heading": str(brand.get("name") or site_name).strip() or site_name,
                "subheading": str(brand.get("description") or "").strip(),
                "copyright": str(content.get("copyright") or "").strip(),
                "footer_note": str(content.get("note") or "").strip(),
                "footer_menus": menus if isinstance(menus, list) else [],
                "background": _bg_framework_to_section(design.get("background")),
            }
            sections.append(sec)
            continue

        # Types optionnels : about, faq, etc. en JSON générique
        if btype in ("AboutBlock", "TextBlock"):
            sec = {
                "type": "about",
                "section_id": bid,
                "nav_label": str(content.get("nav_label") or bid)[:24],
                "heading": str(content.get("heading") or content.get("title") or "About").strip(),
                "subheading": str(content.get("text") or content.get("body") or "").strip(),
                "background": "light",
                "photo_search_query": photo_q,
            }
            sections.append(sec)
            continue

        logger.debug("framework: unknown block type %s, skipped", btype)

    if not sections:
        raise ValueError("framework: no renderable sections after conversion")

    out = {
        "site_name": site_name,
        "description": description,
        "primary_color": primary_color,
        "font": font,
        "html_lang": lang,
        "page_title": page_title,
        "sections": sections,
        "nav_bar": nav_bar,
        "_framework_source": True,
    }
    return out


def normalize_site_structure(structure: dict) -> dict:
    """
    Si la réponse Gemini utilise le schéma framework (projectInfo + page.blocks),
    convertit vers le format legacy. Sinon retourne une copie inchangée.
    """
    if not isinstance(structure, dict):
        return structure

    tid = (structure.get("template_id") or "").strip()
    if tid == "landing-placeholders" and isinstance(structure.get("site"), dict):
        from app.services.site_template_render.landing_placeholders import merge_landing_site

        site = merge_landing_site(structure["site"])
        ph = site.get("placeholders") or {}
        nome = str(ph.get("SITE_TITLE") or "").strip() or "Site"
        idioma = str(site.get("lang") or "fr").strip()[:12] or "fr"
        desc = str(ph.get("CTA_DESC") or ph.get("HERO_SUBTITLE") or nome)[:160]
        return {
            "render_mode": "site_template_v1",
            "template_id": tid,
            "site": site,
            "site_name": nome,
            "page_title": nome,
            "description": desc,
            "html_lang": idioma,
        }

    if tid == "advertising-agency" and isinstance(structure.get("site"), dict):
        from app.services.site_template_render.agency_placeholders import merge_agency_site

        site = merge_agency_site(structure["site"])
        ph = site.get("placeholders") or {}
        nome = str(ph.get("SITE_TITLE") or "").strip() or "Agence"
        idioma = str(site.get("lang") or "fr").strip()[:12] or "fr"
        desc = str(ph.get("HERO_DESC") or ph.get("FOOTER_TAGLINE") or nome)[:160]
        return {
            "render_mode": "site_template_v1",
            "template_id": tid,
            "site": site,
            "site_name": nome,
            "page_title": nome,
            "description": desc,
            "html_lang": idioma,
        }

    if tid in ("hotel-reserva", "ecommerce", "portfolio") and isinstance(structure.get("site"), dict):
        site = structure["site"]
        if tid == "hotel-reserva":
            _normalize_hotel_testimonial_avatars(site)
        if tid == "portfolio" and isinstance(site.get("meta"), dict):
            meta = site["meta"]
            nome = (str(meta.get("siteTitle") or "").strip() or "Portfolio")
            idioma = (str(meta.get("lang") or "fr").strip()[:12] or "fr")
            desc = str(meta.get("siteDescription") or nome)[:160]
        elif tid == "portfolio":
            hero = site.get("hero") if isinstance(site.get("hero"), dict) else {}
            fn = str(hero.get("firstName") or "").strip()
            ln = str(hero.get("lastName") or "").strip()
            nome = (f"{fn} {ln}".strip() or "Portfolio")
            idioma = "fr"
            desc = nome[:160]
        else:
            nome = (site.get("nome") or site.get("nom") or "Site").strip() or "Site"
            idioma = (site.get("idioma") or site.get("langue") or "pt-BR").strip()
            desc = (str(site.get("nome") or site.get("nom") or ""))[:160]
        return {
            "render_mode": "site_template_v1",
            "template_id": tid,
            "site": site,
            "site_name": nome,
            "page_title": nome,
            "description": desc,
            "html_lang": idioma[:12],
        }

    if structure.get("sections") and not structure.get("projectInfo"):
        return dict(structure)
    if structure.get("projectInfo") and structure.get("page"):
        try:
            return framework_to_legacy(structure)
        except Exception as exc:
            logger.warning("framework adapter failed, falling back to raw structure: %s", exc)
            return dict(structure)
    return dict(structure)
