"""
services/site_generator.py
Transforms a Gemini JSON site structure into a complete static HTML file.
Uses Jinja2 with an embedded template for zero external dependencies.
"""
import copy
import json
import logging
import re
import shutil
from pathlib import Path

from jinja2 import Environment, BaseLoader

logger = logging.getLogger(__name__)


def sanitize_href_for_static_preview(url: str | None) -> str:
    """
    Root-relative links (/loja, /contact) resolve to the API host, not the
    preview folder — users leave the generated site and hit the main app.
    For single-page previews, keep anchors (#), full external URLs, mailto/tel,
    and same-folder relatives; turn dangerous or root-relative URLs into "#".
    """
    if url is None:
        return "#"
    u = str(url).strip()
    if not u:
        return "#"
    low = u.lower()
    if low.startswith("javascript:") or low.startswith("data:") or low.startswith("vbscript:"):
        return "#"
    if u.startswith("#"):
        return u
    if low.startswith("mailto:") or low.startswith("tel:"):
        return u
    if low.startswith("http://") or low.startswith("https://"):
        return u
    # protocol-relative external URL
    if u.startswith("//"):
        return u
    # /anything → host root (main app) — block for isolated preview
    if u.startswith("/"):
        return "#"
    return u


def sanitize_external_href(url: str | None) -> str:
    """Allow only https: links (Pexels attribution, etc.)."""
    if url is None:
        return "#"
    u = str(url).strip()
    if u.startswith("https://"):
        return u
    return "#"


def sanitize_img_src(url: str | None) -> str | None:
    """Only allow https images (Pexels / placehold.co hotlinks)."""
    if url is None:
        return None
    u = str(url).strip()
    if u.startswith("https://"):
        return u
    return None


def _assign_section_anchors(sections: list) -> None:
    """Stable HTML id + short nav label for single-page anchor navigation."""
    seen: set[str] = set()
    for i, section in enumerate(sections):
        if not isinstance(section, dict):
            continue
        raw = (section.get("section_id") or "").strip().lower()
        raw = re.sub(r"[^a-z0-9-]+", "-", raw).strip("-")[:50]
        if not raw or len(raw) < 2:
            raw = f"sec-{i}"
        if raw[0].isdigit():
            raw = "s-" + raw
        base = raw
        n = 0
        while raw in seen:
            n += 1
            raw = f"{base}-{n}"
        seen.add(raw)
        section["_anchor_id"] = raw

        label = (section.get("nav_label") or section.get("heading") or "").strip()
        if len(label) > 36:
            label = label[:33].rstrip() + "…"
        section["_nav_label"] = label


SITES_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "sites"
SITES_DIR.mkdir(parents=True, exist_ok=True)

# ── Jinja2 template ─────────────────────────────────────────────────────────

SITE_TEMPLATE = r"""<!DOCTYPE html>
<html lang="{{ html_lang }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{{ description }}">
  <title>{{ page_title }}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family={{ font | replace(' ', '+') }}:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --primary: {{ primary_color }};
      --primary-fg: #fff;
      --bg: #ffffff;
      --bg-alt: #f8f9fb;
      --text: #1a1a2e;
      --text-muted: #6b7280;
      --radius: 12px;
      --font: '{{ font }}', system-ui, sans-serif;
    }
    html { scroll-behavior: smooth; }
    body { font-family: var(--font); color: var(--text); line-height: 1.6; -webkit-font-smoothing: antialiased; }
    a { color: var(--primary); text-decoration: none; }
    img { max-width: 100%; height: auto; display: block; }
    .container { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
    .btn {
      display: inline-block; padding: 14px 32px; border-radius: var(--radius);
      font-weight: 600; font-size: 1rem; cursor: pointer; border: none;
      transition: opacity .2s, transform .15s;
    }
    .btn:hover { opacity: .9; transform: translateY(-1px); }
    .btn-primary { background: var(--primary); color: var(--primary-fg); }
    .btn-outline { background: transparent; border: 2px solid var(--primary); color: var(--primary); }
    section { padding: 80px 0; }
    section.bg-alt { background: var(--bg-alt); }
    section.bg-dark { background: var(--text); color: #fff; }
    section.bg-dark .text-muted { color: #9ca3af; }
    footer.bg-dark { background: var(--text); color: #e5e7eb; border-top-color: rgba(255,255,255,.1); }
    footer.bg-dark .footer-menu a { color: #9ca3af; }
    footer.bg-dark .footer-menu a:hover { color: #fff; }
    footer.bg-dark .footer-bottom { border-top-color: rgba(255,255,255,.15); }
    section.bg-primary { background: var(--primary); color: var(--primary-fg); }
    section.bg-gradient { background: linear-gradient(135deg, var(--primary), #6366f1); color: #fff; }
    .section-heading { font-size: 2.25rem; font-weight: 700; margin-bottom: .5rem; }
    .section-sub { color: var(--text-muted); font-size: 1.1rem; margin-bottom: 48px; max-width: 600px; }
    .text-center { text-align: center; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .grid { display: grid; gap: 24px; }
    .grid-2 { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    .grid-3 { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
    .card {
      background: #fff; border-radius: var(--radius); padding: 32px;
      box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
      transition: box-shadow .2s;
    }
    .card:hover { box-shadow: 0 8px 25px rgba(0,0,0,.08); }
    .card h3 { font-size: 1.25rem; margin-bottom: 8px; }
    .card p { color: var(--text-muted); font-size: .95rem; }

    .site-header {
      position: sticky; top: 0; z-index: 100;
      background: rgba(255, 255, 255, .94);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid #e5e7eb;
    }
    .header-inner {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 12px; padding-top: 14px; padding-bottom: 14px;
    }
    .site-logo { font-weight: 700; font-size: 1.125rem; color: var(--text); }
    .site-logo:hover { color: var(--primary); }
    .header-brand { display: inline-flex; align-items: center; gap: 0; }
    .logo-mark {
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 10px; background: var(--primary);
      color: #fff; font-weight: 700; font-size: 1rem; margin-right: 10px; flex-shrink: 0;
    }
    .nav-cta { padding: 10px 20px !important; font-size: .875rem !important; }
    .site-nav {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end;
      gap: 8px 18px;
    }
    .site-nav a {
      font-size: .875rem; font-weight: 500; color: var(--text-muted);
      padding: 4px 0; border-bottom: 2px solid transparent;
    }
    .site-nav a:hover { color: var(--primary); border-bottom-color: var(--primary); }
    main section[id], footer[id] { scroll-margin-top: 88px; }

    .stock-figure { margin: 0 auto 28px; max-width: 880px; }
    .stock-figure img {
      border-radius: var(--radius); width: 100%; max-height: 480px; object-fit: cover;
      box-shadow: 0 4px 24px rgba(0,0,0,.1);
    }

    /* Hero */
    .hero { padding: 120px 0 100px; text-align: center; }
    .hero.text-left { text-align: left; }
    .hero.text-left p, .hero.text-left .hero-actions { margin-left: 0; margin-right: 0; }
    .hero.text-left p { max-width: 640px; }
    .hero-badge {
      font-size: .875rem; font-weight: 600; color: var(--primary);
      background: var(--bg-alt); border: 1px solid rgba(0,0,0,.06);
      padding: 6px 14px; border-radius: 999px; margin-bottom: 16px; display: inline-block;
    }
    .hero h1 { font-size: clamp(2.5rem, 5vw, 3.75rem); font-weight: 700; line-height: 1.15; margin-bottom: 20px; }
    .hero h1 .hl { color: var(--primary); }
    .hero p.sub { font-size: 1.2rem; color: var(--text-muted); max-width: 640px; margin: 0 auto 28px; }
    .hero.text-left p.sub { margin-left: 0; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; align-items: center; margin-top: 8px; }
    .hero.text-left .hero-actions { justify-content: flex-start; }

    /* FAQ */
    details { border-bottom: 1px solid #e5e7eb; }
    details summary {
      padding: 20px 0; font-weight: 600; cursor: pointer; list-style: none;
      display: flex; align-items: center; justify-content: space-between;
    }
    details summary::after { content: '+'; font-size: 1.5rem; color: var(--primary); transition: transform .2s; }
    details[open] summary::after { content: '−'; }
    details .faq-body { padding: 0 0 20px; color: var(--text-muted); }

    /* Pricing */
    .price-tag { font-size: 2rem; font-weight: 700; color: var(--primary); margin: 12px 0; }

    /* Footer */
    footer { padding: 40px 0; text-align: center; color: var(--text-muted); font-size: .875rem; border-top: 1px solid #e5e7eb; }
    footer.footer-rich { text-align: left; padding: 56px 0; }
    footer .footer-grid { display: grid; gap: 32px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
    footer .footer-menu h4 { font-size: .875rem; font-weight: 600; margin-bottom: 12px; color: var(--text); }
    footer .footer-menu a { display: block; padding: 4px 0; font-size: .875rem; color: var(--text-muted); }
    footer .footer-menu a:hover { color: var(--primary); }
    footer .footer-bottom { margin-top: 36px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; font-size: .8125rem; }
    section.bg-dark + footer.bg-dark .footer-bottom,
    footer.bg-dark .footer-bottom { border-top-color: rgba(255,255,255,.15); }

    @media (max-width: 640px) {
      section { padding: 56px 0; }
      .hero { padding: 80px 0 64px; }
      .section-heading { font-size: 1.75rem; }
      .site-nav { justify-content: flex-start; }
    }
  </style>
</head>
<body>
<header class="site-header">
  <div class="container header-inner">
    {% if nav_bar %}
    <a href="#top" class="site-logo header-brand">
      <span class="logo-mark" aria-hidden="true">{{ nav_bar.logo_letter }}</span>
      <span>{{ nav_bar.logo_text }}</span>
    </a>
    <nav class="site-nav" aria-label="Navigation">
      {% for link in nav_bar.links %}
      <a href="{{ link.href }}">{{ link.label }}</a>
      {% endfor %}
      {% if nav_bar.cta_label %}
      <a href="{{ nav_bar.cta_href }}" class="btn btn-primary nav-cta">{{ nav_bar.cta_label }}</a>
      {% endif %}
    </nav>
    {% else %}
    <a href="#top" class="site-logo">{{ site_name }}</a>
    <nav class="site-nav" aria-label="Navigation">
      {% for section in sections %}
      {% if section.get('_nav_label') %}
      <a href="#{{ section._anchor_id }}">{{ section._nav_label }}</a>
      {% endif %}
      {% endfor %}
    </nav>
    {% endif %}
  </div>
</header>
<main id="top">
{% macro stock_figure(sec) -%}
{% if sec.get('stock_image_url') %}
<div class="stock-figure">
  <img src="{{ sec.stock_image_url }}" alt="{{ sec.heading or '' }}" loading="lazy" width="880" height="495">
</div>
{% endif %}
{%- endmacro %}
{% for section in sections %}
{% if section.type != 'footer' %}
{% set bg_class = '' %}
{% if section.background == 'dark' %}{% set bg_class = 'bg-dark' %}
{% elif section.background == 'primary' %}{% set bg_class = 'bg-primary' %}
{% elif section.background == 'gradient' %}{% set bg_class = 'bg-gradient' %}
{% elif loop.index0 % 2 == 1 %}{% set bg_class = 'bg-alt' %}{% endif %}

{% if section.type == 'hero' %}
<section class="hero {{ bg_class }}{% if section.get('hero_text_align') == 'left' %} text-left{% endif %}" id="{{ section._anchor_id }}">
  <div class="container">
    {{ stock_figure(section) }}
    {% if section.badge %}<p class="hero-badge">{{ section.badge }}</p>{% endif %}
    <h1>{% if section.get('heading_highlight') %}<span>{{ section.get('heading_part1', '') }}</span><span class="hl">{{ section.heading_highlight }}</span><span>{{ section.get('heading_part3', '') }}</span>{% else %}{{ section.heading }}{% endif %}</h1>
    {% if section.subheading %}<p class="sub">{{ section.subheading }}</p>{% endif %}
    <div class="hero-actions">
      {% if section.cta_text %}<a href="{{ section.cta_url or '#' }}" class="btn btn-primary">{{ section.cta_text }}</a>{% endif %}
      {% if section.get('cta_text_secondary') %}<a href="{{ section.cta_url_secondary or '#' }}" class="btn btn-outline">{{ section.cta_text_secondary }}</a>{% endif %}
    </div>
  </div>
</section>

{% elif section.type == 'faq' %}
<section class="{{ bg_class }}" id="{{ section._anchor_id }}">
  <div class="container">
    {{ stock_figure(section) }}
    <h2 class="section-heading text-center">{{ section.heading }}</h2>
    {% if section.subheading %}<p class="section-sub text-center mx-auto">{{ section.subheading }}</p>{% endif %}
    <div style="max-width:720px;margin:0 auto">
      {% for item in section.get("items", []) %}
      <details>
        <summary>{{ item.title }}</summary>
        <div class="faq-body">{{ item.text }}</div>
      </details>
      {% endfor %}
    </div>
  </div>
</section>

{% elif section.type == 'pricing' %}
<section class="{{ bg_class }}" id="{{ section._anchor_id }}">
  <div class="container">
    {{ stock_figure(section) }}
    <h2 class="section-heading text-center">{{ section.heading }}</h2>
    {% if section.subheading %}<p class="section-sub text-center mx-auto">{{ section.subheading }}</p>{% endif %}
    <div class="grid grid-3">
      {% for item in section.get("items", []) %}
      <div class="card text-center">
        <h3>{{ item.title }}</h3>
        {% if item.price %}<div class="price-tag">{{ item.price }}</div>{% endif %}
        <p>{{ item.text }}</p>
      </div>
      {% endfor %}
    </div>
  </div>
</section>

{% elif section.type == 'cta' %}
<section class="{{ bg_class or 'bg-gradient' }}" id="{{ section._anchor_id }}" style="text-align:center">
  <div class="container">
    {{ stock_figure(section) }}
    <h2 class="section-heading">{{ section.heading }}</h2>
    {% if section.subheading %}<p class="section-sub mx-auto" style="color:inherit;opacity:.85">{{ section.subheading }}</p>{% endif %}
    {% if section.cta_text %}<a href="{{ section.cta_url or '#' }}" class="btn btn-primary" style="margin-top:12px">{{ section.cta_text }}</a>{% endif %}
    {% if section.get('cta_secondary_label') %}
    <p style="margin-top:22px;font-size:.95rem;opacity:.9">
      {% if section.get('cta_secondary_note') %}{{ section.cta_secondary_note }} {% endif %}
      <a href="{{ section.cta_secondary_url or '#' }}" style="color:inherit;text-decoration:underline;font-weight:600">{{ section.cta_secondary_label }}</a>
    </p>
    {% endif %}
  </div>
</section>

{% elif section.type == 'contact' %}
<section class="{{ bg_class }}" id="{{ section._anchor_id }}">
  <div class="container" style="max-width:640px">
    {{ stock_figure(section) }}
    <h2 class="section-heading text-center">{{ section.heading }}</h2>
    {% if section.subheading %}<p class="section-sub text-center mx-auto">{{ section.subheading }}</p>{% endif %}
    <form onsubmit="event.preventDefault();alert('Mensagem enviada!')" style="display:grid;gap:16px">
      <input type="text" placeholder="Nome" required style="padding:14px 16px;border:1px solid #d1d5db;border-radius:var(--radius);font-size:1rem;font-family:var(--font)">
      <input type="email" placeholder="Email" required style="padding:14px 16px;border:1px solid #d1d5db;border-radius:var(--radius);font-size:1rem;font-family:var(--font)">
      <textarea placeholder="Mensagem" rows="4" required style="padding:14px 16px;border:1px solid #d1d5db;border-radius:var(--radius);font-size:1rem;font-family:var(--font);resize:vertical"></textarea>
      <button type="submit" class="btn btn-primary">{{ section.cta_text or 'Enviar' }}</button>
    </form>
  </div>
</section>

{% else %}
<section class="{{ bg_class }}" id="{{ section._anchor_id }}">
  <div class="container">
    {{ stock_figure(section) }}
    <h2 class="section-heading text-center">{{ section.heading }}</h2>
    {% if section.subheading %}<p class="section-sub text-center mx-auto">{{ section.subheading }}</p>{% endif %}
    {% if section.get("items") %}
    <div class="grid grid-3">
      {% for item in section.get("items", []) %}
      <div class="card">
        <h3>{{ item.title }}</h3>
        <p>{{ item.text }}</p>
      </div>
      {% endfor %}
    </div>
    {% endif %}
    {% if section.cta_text %}
    <div class="text-center" style="margin-top:40px">
      <a href="{{ section.cta_url or '#' }}" class="btn btn-primary">{{ section.cta_text }}</a>
    </div>
    {% endif %}
  </div>
</section>
{% endif %}
{% endif %}
{% endfor %}
</main>
{% for section in sections %}
{% if section.type == 'footer' %}
{% set bg_class = '' %}
{% if section.background == 'dark' %}{% set bg_class = 'bg-dark' %}
{% elif section.background == 'primary' %}{% set bg_class = 'bg-primary' %}
{% elif section.background == 'gradient' %}{% set bg_class = 'bg-gradient' %}
{% elif loop.index0 % 2 == 1 %}{% set bg_class = 'bg-alt' %}{% endif %}
<footer class="{{ bg_class }}{% if section.get('footer_menus') %} footer-rich{% endif %}" id="{{ section._anchor_id }}">
  <div class="container">
    {% if section.get('footer_menus') %}
    <div class="footer-grid">
      <div>
        <p style="font-weight:700;font-size:1.125rem;margin-bottom:8px;color:inherit">{{ section.heading }}</p>
        {% if section.subheading %}<p style="opacity:.85;font-size:.9rem;max-width:320px">{{ section.subheading }}</p>{% endif %}
      </div>
      {% for menu in section.footer_menus %}
      <div class="footer-menu">
        <h4>{{ menu.title }}</h4>
        {% for L in menu.get('links', []) %}
        <a href="{{ L.href }}">{{ L.label }}</a>
        {% endfor %}
      </div>
      {% endfor %}
    </div>
    <div class="footer-bottom">
      {% if section.copyright %}<p>{{ section.copyright }}</p>{% endif %}
      {% if section.footer_note %}<p style="margin-top:8px">{{ section.footer_note }}</p>{% endif %}
    </div>
    {% else %}
    <p>{{ section.heading }}</p>
    {% if section.subheading %}<p style="margin-top:4px">{{ section.subheading }}</p>{% endif %}
    {% if section.copyright %}<p style="margin-top:16px;font-size:.8125rem">{{ section.copyright }}</p>{% endif %}
    {% if section.footer_note %}<p style="margin-top:8px;font-size:.8125rem">{{ section.footer_note }}</p>{% endif %}
    {% endif %}
  </div>
</footer>
{% endif %}
{% endfor %}
</body>
</html>"""


_env = Environment(loader=BaseLoader(), autoescape=False)
_template = _env.from_string(SITE_TEMPLATE)


def generate_html(structure: dict) -> str:
    """Render the JSON structure into a complete HTML string."""
    data = copy.deepcopy(structure)
    if data.get("render_mode") == "site_template_v1" or (
        (data.get("template_id") or "").strip() in ("hotel-reserva", "ecommerce", "portfolio")
        and isinstance(data.get("site"), dict)
    ):
        from app.services.site_template_render.render import render_site_template_html

        return render_site_template_html(data)

    sections = data.get("sections", [])
    _assign_section_anchors(sections)

    nav_bar = data.get("nav_bar")
    if isinstance(nav_bar, dict):
        for link in nav_bar.get("links") or []:
            if isinstance(link, dict) and "href" in link:
                link["href"] = sanitize_href_for_static_preview(link.get("href"))
        nav_bar["cta_href"] = sanitize_href_for_static_preview(nav_bar.get("cta_href"))

    for section in sections:
        if not isinstance(section, dict):
            continue
        if "cta_url" in section:
            section["cta_url"] = sanitize_href_for_static_preview(section.get("cta_url"))
        if "cta_url_secondary" in section:
            section["cta_url_secondary"] = sanitize_href_for_static_preview(
                section.get("cta_url_secondary")
            )
        if "cta_secondary_url" in section:
            section["cta_secondary_url"] = sanitize_href_for_static_preview(
                section.get("cta_secondary_url")
            )
        for item in section.get("footer_menus") or []:
            if not isinstance(item, dict):
                continue
            for link in item.get("links") or []:
                if isinstance(link, dict) and "href" in link:
                    link["href"] = sanitize_href_for_static_preview(link.get("href"))
        if section.get("stock_image_url"):
            safe_src = sanitize_img_src(section.get("stock_image_url"))
            if safe_src:
                section["stock_image_url"] = safe_src
            else:
                section.pop("stock_image_url", None)
                section.pop("stock_photo_by", None)
                section.pop("stock_image_source", None)

    site_name = data.get("site_name", "Meu Site")
    page_title = (data.get("page_title") or site_name or "Site").strip() or site_name
    html_lang = (data.get("html_lang") or "pt-BR").strip() or "pt-BR"

    return _template.render(
        site_name=site_name,
        page_title=page_title,
        html_lang=html_lang,
        description=data.get("description", ""),
        primary_color=data.get("primary_color", "#6366f1"),
        font=data.get("font", "Inter"),
        sections=data.get("sections", []),
        nav_bar=nav_bar if isinstance(nav_bar, dict) else None,
    )


def save_site(project_id: str, html: str, structure: dict) -> tuple[str, str]:
    """
    Write the HTML + structure.json to uploads/sites/<project_id>/.
    Returns (html_path, preview_url) as relative URL strings.
    """
    site_dir = SITES_DIR / project_id
    if site_dir.exists():
        shutil.rmtree(site_dir)
    site_dir.mkdir(parents=True, exist_ok=True)

    index_path = site_dir / "index.html"
    index_path.write_text(html, encoding="utf-8")

    json_path = site_dir / "structure.json"
    json_path.write_text(json.dumps(structure, ensure_ascii=False, indent=2), encoding="utf-8")

    html_url = f"/uploads/sites/{project_id}/index.html"
    preview_url = f"/uploads/sites/{project_id}/index.html"
    return html_url, preview_url
