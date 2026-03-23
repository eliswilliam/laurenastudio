"""
services/site_generator.py
Transforms a Gemini JSON site structure into a complete static HTML file.
Uses Jinja2 with an embedded template for zero external dependencies.
"""
import copy
import json
import logging
import shutil
import zipfile
from io import BytesIO
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


SITES_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "sites"
SITES_DIR.mkdir(parents=True, exist_ok=True)

# ── Jinja2 template ─────────────────────────────────────────────────────────

SITE_TEMPLATE = r"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{{ description }}">
  <title>{{ site_name }}</title>
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

    .stock-figure { margin: 0 auto 28px; max-width: 880px; }
    .stock-figure img {
      border-radius: var(--radius); width: 100%; max-height: 480px; object-fit: cover;
      box-shadow: 0 4px 24px rgba(0,0,0,.1);
    }
    .photo-credit { font-size: .75rem; color: var(--text-muted); margin-top: 10px; text-align: center; }
    .photo-credit a { text-decoration: underline; }

    /* Hero */
    .hero { padding: 120px 0 100px; text-align: center; }
    .hero h1 { font-size: clamp(2.5rem, 5vw, 3.75rem); font-weight: 700; line-height: 1.15; margin-bottom: 20px; }
    .hero p { font-size: 1.2rem; color: var(--text-muted); max-width: 640px; margin: 0 auto 36px; }

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

    @media (max-width: 640px) {
      section { padding: 56px 0; }
      .hero { padding: 80px 0 64px; }
      .section-heading { font-size: 1.75rem; }
    }
  </style>
</head>
<body>
{% macro stock_figure(sec) -%}
{% if sec.get('stock_image_url') %}
<div class="stock-figure">
  <img src="{{ sec.stock_image_url }}" alt="" loading="lazy" width="880" height="495">
  {% if sec.get('stock_photo_by') and sec.get('stock_image_source') == 'pexels' %}
  <p class="photo-credit">Photo by <a href="{{ sec.stock_photo_by_url }}" target="_blank" rel="noopener noreferrer">{{ sec.stock_photo_by }}</a> on <a href="https://www.pexels.com/" target="_blank" rel="noopener noreferrer">Pexels</a></p>
  {% endif %}
</div>
{% endif %}
{%- endmacro %}
{% for section in sections %}
{% set bg_class = '' %}
{% if section.background == 'dark' %}{% set bg_class = 'bg-dark' %}
{% elif section.background == 'primary' %}{% set bg_class = 'bg-primary' %}
{% elif section.background == 'gradient' %}{% set bg_class = 'bg-gradient' %}
{% elif loop.index0 % 2 == 1 %}{% set bg_class = 'bg-alt' %}{% endif %}

{% if section.type == 'hero' %}
<section class="hero {{ bg_class }}">
  <div class="container">
    {{ stock_figure(section) }}
    <h1>{{ section.heading }}</h1>
    {% if section.subheading %}<p>{{ section.subheading }}</p>{% endif %}
    {% if section.cta_text %}<a href="{{ section.cta_url or '#' }}" class="btn btn-primary">{{ section.cta_text }}</a>{% endif %}
  </div>
</section>

{% elif section.type == 'footer' %}
<footer class="{{ bg_class }}">
  <div class="container">
    <p>{{ section.heading }}</p>
    {% if section.subheading %}<p style="margin-top:4px">{{ section.subheading }}</p>{% endif %}
  </div>
</footer>

{% elif section.type == 'faq' %}
<section class="{{ bg_class }}">
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
<section class="{{ bg_class }}">
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
<section class="{{ bg_class or 'bg-gradient' }}" style="text-align:center">
  <div class="container">
    {{ stock_figure(section) }}
    <h2 class="section-heading">{{ section.heading }}</h2>
    {% if section.subheading %}<p class="section-sub mx-auto" style="color:inherit;opacity:.85">{{ section.subheading }}</p>{% endif %}
    {% if section.cta_text %}<a href="{{ section.cta_url or '#' }}" class="btn btn-primary" style="margin-top:12px">{{ section.cta_text }}</a>{% endif %}
  </div>
</section>

{% elif section.type == 'contact' %}
<section class="{{ bg_class }}">
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
<section class="{{ bg_class }}">
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
{% endfor %}
</body>
</html>"""


_env = Environment(loader=BaseLoader(), autoescape=False)
_template = _env.from_string(SITE_TEMPLATE)


def generate_html(structure: dict) -> str:
    """Render the JSON structure into a complete HTML string."""
    data = copy.deepcopy(structure)
    for section in data.get("sections", []):
        if not isinstance(section, dict):
            continue
        if "cta_url" in section:
            section["cta_url"] = sanitize_href_for_static_preview(section.get("cta_url"))
        section["stock_photo_by_url"] = sanitize_external_href(section.get("stock_photo_by_url"))
        section["stock_photo_page_url"] = sanitize_external_href(section.get("stock_photo_page_url"))
        if section.get("stock_image_url"):
            safe_src = sanitize_img_src(section.get("stock_image_url"))
            if safe_src:
                section["stock_image_url"] = safe_src
            else:
                section.pop("stock_image_url", None)
                section.pop("stock_photo_by", None)
                section.pop("stock_image_source", None)
    return _template.render(
        site_name=data.get("site_name", "Meu Site"),
        description=data.get("description", ""),
        primary_color=data.get("primary_color", "#6366f1"),
        font=data.get("font", "Inter"),
        sections=data.get("sections", []),
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


def create_zip(project_id: str) -> bytes | None:
    """Create an in-memory ZIP of the site folder. Returns bytes or None."""
    site_dir = SITES_DIR / project_id
    if not site_dir.exists():
        return None

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in site_dir.rglob("*"):
            if file.is_file():
                zf.write(file, file.relative_to(site_dir))
    return buf.getvalue()
