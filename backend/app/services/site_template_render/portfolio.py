"""Rendu single-page portfolio â€” schÃ©ma fixe meta / hero / about / projects / services / contact / footer."""
from __future__ import annotations

from typing import Any

from app.services.site_template_render._utils import (
    coerce_mapping_list,
    google_fonts_link,
    jinja_env,
    font_query_name,
)

_MANGLED_EM_DASH = b"\xe2\x80\x94".decode("cp1252")

_MOJIBAKE_PAIRS: tuple[tuple[str, str], ...] = (
    (_MANGLED_EM_DASH, "\u2014"),
    ("\u00e2\u20ac\u2122", "\u2014"),
    ("ÃƒÂ©", "Ã©"),
    ("ÃƒÂ¨", "Ã¨"),
    ("Ãƒ ", "Ã "),
    ("ÃƒÂ§", "Ã§"),
    ("ÃƒÂª", "Ãª"),
    ("ÃƒÂ´", "Ã´"),
    ("ÃƒÂ¹", "Ã¹"),
    ("Ã¢â‚¬â„¢", "'"),
)


def _fix_mojibake(s: str) -> str:
    if not s:
        return s
    out = s
    for bad, good in _MOJIBAKE_PAIRS:
        out = out.replace(bad, good)
    return out


def _deep_fix_strings(obj: Any) -> Any:
    if isinstance(obj, str):
        return _fix_mojibake(obj)
    if isinstance(obj, list):
        for i, x in enumerate(obj):
            obj[i] = _deep_fix_strings(x)
        return obj
    if isinstance(obj, dict):
        for k, v in list(obj.items()):
            obj[k] = _deep_fix_strings(v)
        return obj
    return obj


def _safe_href(url: str | None) -> str:
    if not url:
        return "#"
    u = str(url).strip()
    if not u:
        return "#"
    low = u.lower()
    if low.startswith("javascript:") or low.startswith("data:"):
        return "#"
    if u.startswith("#") or low.startswith("mailto:") or low.startswith("tel:"):
        return u
    if u.startswith("https://"):
        return u
    return "#"


def _ensure_meta(site: dict[str, Any]) -> dict[str, Any]:
    m = site.get("meta")
    if not isinstance(m, dict):
        m = {}
    return {
        "siteTitle": str(m.get("siteTitle") or "Portfolio").strip() or "Portfolio",
        "siteDescription": str(m.get("siteDescription") or "").strip(),
        "lang": str(m.get("lang") or "fr").strip()[:12] or "fr",
        "favicon": str(m.get("favicon") or "âœ¦").strip() or "âœ¦",
    }


def _normalize_site(site: dict[str, Any]) -> dict[str, Any]:
    out = dict(site)
    out["meta"] = _ensure_meta(out)

    hero = out.get("hero") if isinstance(out.get("hero"), dict) else {}
    out["hero"] = {
        "firstName": str(hero.get("firstName") or "").strip(),
        "lastName": str(hero.get("lastName") or "").strip(),
        "title": str(hero.get("title") or "").strip(),
        "tagline": str(hero.get("tagline") or "").strip(),
        "ctaLabel": str(hero.get("ctaLabel") or "Projets").strip(),
        "ctaAnchor": str(hero.get("ctaAnchor") or "#projets").strip() or "#projets",
    }

    about = out.get("about") if isinstance(out.get("about"), dict) else {}
    skills = about.get("skills")
    if not isinstance(skills, list):
        skills = []
    out["about"] = {
        "heading": str(about.get("heading") or "Ã€ propos").strip(),
        "bio": str(about.get("bio") or "").strip(),
        "skills": [str(x).strip() for x in skills if str(x).strip()],
        "availability": str(about.get("availability") or "").strip(),
    }

    projects_raw = out.get("projects")
    if not isinstance(projects_raw, list):
        projects_raw = []
    coerce_mapping_list(projects_raw)
    projects: list[dict[str, Any]] = []
    for i, p in enumerate(projects_raw):
        if not isinstance(p, dict):
            continue
        tags = p.get("tags")
        if not isinstance(tags, list):
            tags = []
        # Bandeau projet : accent fixe du gabarit (pas de personnalisation couleur par l'IA).
        col = "#8b7355"
        projects.append(
            {
                "id": str(p.get("id") or f"{i+1:02d}").strip(),
                "title": str(p.get("title") or "").strip(),
                "category": str(p.get("category") or "").strip(),
                "year": str(p.get("year") or "").strip(),
                "description": str(p.get("description") or "").strip(),
                "tags": [str(t).strip() for t in tags if str(t).strip()],
                "color": col,
                "image": str(p.get("image") or "").strip() or None,
            }
        )
    out["projects"] = projects

    services_raw = out.get("services")
    if not isinstance(services_raw, list):
        services_raw = []
    coerce_mapping_list(services_raw)
    services = []
    for s in services_raw:
        if not isinstance(s, dict):
            continue
        services.append(
            {
                "icon": str(s.get("icon") or "").strip(),
                "title": str(s.get("title") or "").strip(),
                "description": str(s.get("description") or "").strip(),
            }
        )
    out["services"] = services

    c = out.get("contact") if isinstance(out.get("contact"), dict) else {}
    social_raw = c.get("social")
    if not isinstance(social_raw, list):
        social_raw = []
    coerce_mapping_list(social_raw)
    social: list[dict[str, str]] = []
    for item in social_raw:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or "").strip()
        url = _safe_href(item.get("url"))
        if label:
            social.append({"label": label, "url": url})
    out["contact"] = {
        "heading": str(c.get("heading") or "Contact").strip(),
        "subheading": str(c.get("subheading") or "").strip(),
        "email": str(c.get("email") or "").strip(),
        "phone": str(c.get("phone") or "").strip(),
        "location": str(c.get("location") or "").strip(),
        "social": social,
    }

    f = out.get("footer") if isinstance(out.get("footer"), dict) else {}
    out["footer"] = {
        "copyright": str(f.get("copyright") or "").strip(),
        "madeWith": str(f.get("madeWith") or "").strip(),
    }

    design = out.get("design") if isinstance(out.get("design"), dict) else {}
    tip = design.get("typographie") if isinstance(design.get("typographie"), dict) else {}
    out["_display_font"] = font_query_name(tip.get("display")) if tip else "Cormorant Garamond"
    out["_body_font"] = font_query_name(tip.get("corps")) if tip else "Syne"

    return out


_TEMPLATE = jinja_env.from_string(
    """<!DOCTYPE html>
<html lang="{{ meta.lang|e }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ meta.siteTitle|e }}</title>
  <meta name="description" content="{{ meta.siteDescription|e }}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="{{ fonts_url }}" rel="stylesheet">
  <style>
:root {
  --bg: #f7f4ee;
  --bg2: #efe9df;
  --ink: #1a1814;
  --muted: #5c574c;
  --line: #d4ccc0;
  --accent: #8b7355;
  --font-display: "{{ fd }}", "Georgia", serif;
  --font-body: "{{ fb }}", system-ui, sans-serif;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--font-body);background:var(--bg);color:var(--ink);line-height:1.65;font-size:1.02rem}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
img{max-width:100%;display:block;border-radius:4px}
.container{max-width:1040px;margin:0 auto;padding:0 22px}
header{position:sticky;top:0;z-index:40;background:rgba(247,244,238,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.nav-inner{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 0;flex-wrap:wrap}
.brand{font-family:var(--font-display);font-weight:600;font-size:1.05rem;letter-spacing:-0.02em}
.brand span{opacity:.45;margin:0 .35em}
nav{display:flex;gap:1.25rem;flex-wrap:wrap;font-size:.88rem}
nav a{color:var(--muted)}
nav a:hover{color:var(--ink)}
.hero{padding:4.5rem 0 3rem}
.hero-kicker{font-size:.75rem;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);margin-bottom:.75rem}
.hero h1{font-family:var(--font-display);font-weight:500;font-size:clamp(2.4rem,6vw,3.75rem);line-height:1.08;letter-spacing:-0.03em}
.hero .role{font-family:var(--font-display);font-size:clamp(1.15rem,2.5vw,1.45rem);color:var(--muted);margin-top:.35rem;font-weight:400}
.hero p.tagline{max-width:34rem;margin-top:1.35rem;color:var(--muted);font-size:1.05rem}
.hero .cta{margin-top:1.75rem;display:inline-block;padding:12px 26px;border:1px solid var(--ink);color:var(--ink);font-size:.9rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.hero .cta:hover{background:var(--ink);color:var(--bg);text-decoration:none}
section{padding:3.5rem 0}
section h2{font-family:var(--font-display);font-size:clamp(1.65rem,3vw,2.1rem);font-weight:500;margin-bottom:1.25rem}
.about-bio{max-width:40rem;color:var(--muted)}
.skills{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1.25rem}
.skills span{font-size:.8rem;padding:.35rem .7rem;border:1px solid var(--line);border-radius:999px;color:var(--muted)}
.avail{margin-top:1.5rem;font-size:.92rem;color:var(--accent);font-weight:500}
.proj-list{display:grid;gap:1.25rem;margin-top:2rem}
.proj-card{display:grid;grid-template-columns:140px 1fr;gap:0;overflow:hidden;border:1px solid var(--line);border-radius:6px;background:#fff}
@media(max-width:700px){.proj-card{grid-template-columns:1fr}}
.proj-swatch{width:100%;min-height:100%;background:var(--pcolor,#ccc)}
.proj-swatch img{width:100%;height:100%;object-fit:cover;min-height:140px}
.proj-body{padding:1.25rem 1.35rem}
.proj-meta{display:flex;gap:.75rem;flex-wrap:wrap;align-items:baseline;font-size:.8rem;color:var(--muted);margin-bottom:.35rem}
.proj-meta .cat{font-weight:600;color:var(--ink)}
.proj-body h3{font-family:var(--font-display);font-size:1.2rem;font-weight:500;margin-bottom:.5rem}
.proj-body p{font-size:.92rem;color:var(--muted)}
.proj-tags{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.75rem}
.proj-tags span{font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.services-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.5rem;margin-top:2rem}
.svc{border:1px solid var(--line);border-radius:6px;padding:1.48rem;background:#fff}
.svc .ic{font-family:var(--font-display);font-size:1.5rem;margin-bottom:.65rem;color:var(--accent)}
.svc h3{font-family:var(--font-display);font-size:1.05rem;margin-bottom:.5rem}
.svc p{font-size:.9rem;color:var(--muted)}
.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:2rem;margin-top:1.5rem}
@media(max-width:720px){.contact-grid{grid-template-columns:1fr}}
.contact-block p{margin-bottom:.65rem;font-size:.95rem}
.contact-block .lab{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.08em}
.social-row{display:flex;flex-wrap:wrap;gap:1rem;margin-top:1rem}
footer{padding:2.5rem 0 3rem;border-top:1px solid var(--line);margin-top:2rem;text-align:center;font-size:.85rem;color:var(--muted)}
footer p + p{margin-top:.5rem}
.fade-up{opacity:0;transform:translateY(14px);transition:opacity .55s ease,transform .55s ease}
.fade-up.visible{opacity:1;transform:none}
  </style>
</head>
<body>
<header>
  <div class="container nav-inner">
    <a href="#top" class="brand">{{ hero.firstName|e }}{% if hero.firstName and hero.lastName %} <span>/</span> {% endif %}{{ hero.lastName|e }}</a>
    <nav>
      <a href="#about">{{ about.heading|e }}</a>
      <a href="#projets">Projets</a>
      {% if services %}<a href="#services">Services</a>{% endif %}
      <a href="#contact">{{ contact.heading|e }}</a>
    </nav>
  </div>
</header>
<main id="top">
<section class="hero container fade-up">
  <p class="hero-kicker">{{ meta.favicon|e }} Portfolio</p>
  <h1>{{ hero.firstName|e }}{% if hero.firstName and hero.lastName %} {{ hero.lastName|e }}{% elif hero.lastName %}{{ hero.lastName|e }}{% endif %}</h1>
  {% if hero.title %}<p class="role">{{ hero.title|e }}</p>{% endif %}
  {% if hero.tagline %}<p class="tagline">{{ hero.tagline|e }}</p>{% endif %}
  <a class="cta" href="{{ hero.ctaAnchor|e }}">{{ hero.ctaLabel|e }}</a>
</section>

<section class="container fade-up" id="about">
  <h2>{{ about.heading|e }}</h2>
  <p class="about-bio">{{ about.bio|e }}</p>
  {% if about.skills %}
  <div class="skills">
    {% for sk in about.skills %}<span>{{ sk|e }}</span>{% endfor %}
  </div>
  {% endif %}
  {% if about.availability %}<p class="avail">{{ about.availability|e }}</p>{% endif %}
</section>

<section class="container fade-up" id="projets">
  <h2>Projets sÃ©lectionnÃ©s</h2>
  <div class="proj-list">
    {% for p in projects %}
    <article class="proj-card">
      <div class="proj-swatch" style="--pcolor:{{ p.color|e }}">
        {% if p.image %}<img src="{{ p.image|e }}" alt="{{ p.title|e }}">{% endif %}
      </div>
      <div class="proj-body">
        <div class="proj-meta">
          {% if p.id %}<span>#{{ p.id|e }}</span>{% endif %}
          {% if p.category %}<span class="cat">{{ p.category|e }}</span>{% endif %}
          {% if p.year %}<span>{{ p.year|e }}</span>{% endif %}
        </div>
        <h3>{{ p.title|e }}</h3>
        <p>{{ p.description|e }}</p>
        {% if p.tags %}
        <div class="proj-tags">
          {% for t in p.tags %}<span>{{ t|e }}</span>{% endfor %}
        </div>
        {% endif %}
      </div>
    </article>
    {% endfor %}
  </div>
</section>

{% if services %}
<section class="container fade-up" id="services">
  <h2>Services</h2>
  <div class="services-grid">
    {% for s in services %}
    <div class="svc">
      <div class="ic">{{ s.icon|e }}</div>
      <h3>{{ s.title|e }}</h3>
      <p>{{ s.description|e }}</p>
    </div>
    {% endfor %}
  </div>
</section>
{% endif %}

<section class="container fade-up" id="contact">
  <h2>{{ contact.heading|e }}</h2>
  {% if contact.subheading %}<p class="about-bio">{{ contact.subheading|e }}</p>{% endif %}
  <div class="contact-grid">
    <div class="contact-block">
      {% if contact.email %}
      <p><span class="lab">Email</span><br><a href="mailto:{{ contact.email|e }}">{{ contact.email|e }}</a></p>
      {% endif %}
      {% if contact.phone %}
      <p><span class="lab">TÃ©lÃ©phone</span><br><a href="tel:{{ contact.phone|replace(' ', '')|e }}">{{ contact.phone|e }}</a></p>
      {% endif %}
      {% if contact.location %}
      <p><span class="lab">Localisation</span><br>{{ contact.location|e }}</p>
      {% endif %}
    </div>
    <div class="contact-block">
      {% if contact.social %}
      <p class="lab">RÃ©seaux</p>
      <div class="social-row">
        {% for soc in contact.social %}
        <a href="{{ soc.url|e }}" rel="noopener noreferrer">{{ soc.label|e }}</a>
        {% endfor %}
      </div>
      {% endif %}
    </div>
  </div>
</section>
</main>
<footer class="fade-up">
  <div class="container">
    {% if footer.copyright %}<p>{{ footer.copyright|e }}</p>{% endif %}
    {% if footer.madeWith %}<p>{{ footer.madeWith|e }}</p>{% endif %}
  </div>
</footer>
<script>
(function(){
  var io=new IntersectionObserver(function(ents){ents.forEach(function(e){if(e.isIntersecting)e.target.classList.add("visible");});},{threshold:.12});
  document.querySelectorAll(".fade-up").forEach(function(el){io.observe(el);});
})();
</script>
</body>
</html>"""
)


def render_portfolio(site: dict[str, Any]) -> str:
    site = dict(site)
    if not isinstance(site.get("meta"), dict):
        raise ValueError(
            'portfolio: l\'objet Â« site Â» doit inclure Â« meta Â» '
            "(siteTitle, siteDescription, lang, favicon)."
        )
    _deep_fix_strings(site)
    data = _normalize_site(site)
    meta = data["meta"]
    hero = data["hero"]
    fd = data["_display_font"]
    fb = data["_body_font"]
    fonts_url = google_fonts_link(data["_display_font"], data["_body_font"])

    return _TEMPLATE.render(
        meta=meta,
        hero=hero,
        about=data["about"],
        projects=data["projects"],
        services=data["services"],
        contact=data["contact"],
        footer=data["footer"],
        fonts_url=fonts_url,
        fd=fd,
        fb=fb,
    )
