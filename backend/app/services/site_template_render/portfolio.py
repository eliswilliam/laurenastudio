"""Rendu single-page pour le framework portfolio (JSON `site`, clés FR)."""
from __future__ import annotations

import re
from typing import Any

from app.services.site_template_render._utils import (
    coerce_mapping_list,
    coerce_str_to_mapping,
    font_query_name,
    google_fonts_link,
    jinja_env,
)


def _skill_bar_pct(niveau: Any) -> int:
    if isinstance(niveau, (int, float)):
        return max(0, min(100, int(niveau)))
    if isinstance(niveau, str):
        digits = re.sub(r"[^\d]", "", niveau)
        if not digits:
            return 75
        v = int(digits[:3])
        if v > 100:
            v = min(100, v // 10)
        return max(5, min(100, v))
    return 75


_TIPO_TO_TYPE: dict[str, str] = {
    "navigation": "navigation",
    "navegacao": "navigation",
    "nav": "navigation",
    "hero": "hero",
    "a_propos": "a_propos",
    "sobre": "a_propos",
    "competences_onglets": "competences_onglets",
    "competencias": "competences_onglets",
    "areas": "competences_onglets",
    "grille_projets": "grille_projets",
    "projetos": "grille_projets",
    "casos": "grille_projets",
    "timeline": "timeline",
    "trajetoria": "timeline",
    "experiencia": "timeline",
    "contact": "contact",
    "contato": "contact",
    "footer": "footer",
    "rodape": "footer",
}

# UTF-8 « — » (e2 80 94) lu en cp1252 donne souvent cette séquence ; normaliser en vrai tiret cadratin.
_MANGLED_EM_DASH = b"\xe2\x80\x94".decode("cp1252")

# Corrige les séquences fréquentes quand du UTF-8 a été mal interprété.
_MOJIBAKE_PAIRS: tuple[tuple[str, str], ...] = (
    (_MANGLED_EM_DASH, "\u2014"),
    ("\u00e2\u20ac\u2122", "\u2014"),
    ("\u00e2\u20ac\u201c", "\u2014"),
    ("\u00e2\u20ac\u201d", "\u2014"),
    ("Ã©", "é"),
    ("Ã¨", "è"),
    ("Ã ", "à"),
    ("Ã§", "ç"),
    ("Ãª", "ê"),
    ("Ã«", "ë"),
    ("Ã®", "î"),
    ("Ã¯", "ï"),
    ("Ã´", "ô"),
    ("Ã¹", "ù"),
    ("Ã»", "û"),
    ("Ã¼", "ü"),
    ("Å\x93", "œ"),
    ("Ã†", "Æ"),
    ("â€™", "'"),
    ("â€œ", "\u201c"),
    ("â€", "\u201d"),
    ("â€“", "\u2013"),
)

_SLUG_NUMERO = re.compile(r"^[a-z][a-z0-9_-]*$", re.I)


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


def _looks_like_image_path(s: Any) -> bool:
    if not s or not isinstance(s, str):
        return False
    lower = s.lower().strip()
    return lower.endswith((".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"))


_ICON_ALIASES: dict[str, str] = {
    "calculator": "\U0001f522",
    "calc": "\U0001f522",
    "book": "\U0001f4da",
    "books": "\U0001f4da",
    "flask": "\U0001f52c",
    "science": "\U0001f52c",
    "history": "\U0001f4dc",
    "email": "\u2709",
    "mail": "\u2709",
    "phone": "\u260e",
    "telephone": "\u260e",
    "location": "\U0001f4cd",
    "map": "\U0001f4cd",
    "adresse": "\U0001f4cd",
    "school": "\U0001f3eb",
    "users": "\U0001f465",
    "user": "\U0001f464",
    "star": "\u2605",
}


def _icone_visuel(raw: Any) -> str:
    if raw is None:
        return ""
    s = str(raw).strip()
    if not s:
        return ""
    if len(s) <= 4 and any(ord(c) > 127 for c in s):
        return s
    k = re.sub(r"\s+", "_", s.lower())
    mapped = _ICON_ALIASES.get(k)
    if mapped:
        return mapped
    if all(ord(c) < 128 for c in s):
        return ""
    return s


def _format_kicker_for_section(numero_section: Any, content_index: int) -> str:
    if numero_section is not None:
        raw = str(numero_section).strip()
        if raw and _SLUG_NUMERO.match(raw):
            return f"{content_index:02d}"
        if raw.isdigit():
            return raw.zfill(2) if len(raw) <= 3 else raw
        if raw:
            return raw
    return f"{content_index:02d}"


def _assign_nav_anchors_to_sections(sections: list[Any], nav: dict[str, Any] | None) -> None:
    if not nav:
        return
    anchors: list[str] = []
    for l in nav.get("liens") or []:
        href: str | None = None
        if isinstance(l, dict):
            href = l.get("href") or l.get("url")
        if isinstance(href, str) and href.startswith("#"):
            a = href[1:].strip()
            if a:
                anchors.append(a)
    i = 0
    for sec in sections:
        if not isinstance(sec, dict):
            continue
        if (sec.get("type") or "") in ("navigation", "footer"):
            continue
        if i < len(anchors) and anchors[i]:
            sec.setdefault("id", anchors[i])
        i += 1


def _enrich_content_sections(sections: list[Any]) -> None:
    content_index = 0
    for sec in sections:
        if not isinstance(sec, dict):
            continue
        if (sec.get("type") or "") in ("navigation", "footer"):
            continue
        content_index += 1
        numero = sec.get("numero_section")
        sid = sec.get("id")
        if not sid and isinstance(numero, str) and _SLUG_NUMERO.match(numero.strip()):
            sec["id"] = numero.strip().lower()
        elif not sid:
            sec["id"] = f"section-{content_index}"
        sec["_kicker"] = _format_kicker_for_section(numero, content_index)

        st = sec.get("type")
        if st == "competences_onglets":
            for cat in sec.get("categories") or []:
                if not isinstance(cat, dict):
                    continue
                for sk in cat.get("competences") or []:
                    if isinstance(sk, dict):
                        sk["_icone_html"] = _icone_visuel(sk.get("icone"))
        elif st == "contact":
            for inf in sec.get("informations") or []:
                if isinstance(inf, dict):
                    inf["_icone_html"] = _icone_visuel(inf.get("icone"))
        elif st == "footer":
            logo = sec.get("logo")
            sec["_footer_logo_src"] = str(logo).strip() if _looks_like_image_path(logo) else None


_PALETTE_KEY_MAP: dict[str, str] = {
    "background": "bg",
    "fond": "bg",
    "arriere_plan": "bg",
    "primary": "cyan",
    "primaire": "cyan",
    "accent": "cyan",
    "secondary": "violet",
    "secondaire": "violet",
    "surface_alt": "surface2",
    "carte": "surface",
    "texte": "white",
    "text": "white",
    "muted_text": "muted",
}

_DEFAULT_PAL: dict[str, str] = {
    "bg": "#060810",
    "bg2": "#0c1020",
    "surface": "#111827",
    "surface2": "#0d1222",
    "border": "#1e2a3a",
    "cyan": "#00e5ff",
    "violet": "#b44dff",
    "white": "#eef2ff",
    "muted": "#5a6a88",
    "green": "#00ff9d",
}


def _normalize_palette(raw: dict[str, Any]) -> dict[str, str]:
    out: dict[str, str] = dict(_DEFAULT_PAL)
    for k, v in (raw or {}).items():
        if not isinstance(k, str) or v is None:
            continue
        key = str(k).strip().lower()
        key = _PALETTE_KEY_MAP.get(key, key)
        out[key] = str(v).strip()
    if "surface2" not in out or not out.get("surface2"):
        out["surface2"] = out.get("surface", _DEFAULT_PAL["surface"])
    return out


def _normalize_portfolio_sections(sections: list[Any]) -> None:
    """Normalise type/tipo, _bar_pct pour les compétences."""
    for sec in sections:
        if not isinstance(sec, dict):
            continue
        raw = sec.get("type") or sec.get("tipo")
        if raw:
            key = str(raw).strip().lower().replace(" ", "_")
            sec["type"] = _TIPO_TO_TYPE.get(key, key)
        st = sec.get("type")
        for key in ("boutons", "botoes", "stats"):
            if isinstance(sec.get(key), list):
                coerce_mapping_list(sec[key])
        for key in ("liens", "links"):
            if isinstance(sec.get(key), list):
                coerce_mapping_list(sec[key])
        if sec.get("cta") is not None:
            sec["cta"] = coerce_str_to_mapping(sec["cta"])
        if st == "competences_onglets":
            for cat in sec.get("categories") or []:
                if not isinstance(cat, dict):
                    continue
                coerce_mapping_list(cat.get("competences") or [])
                for sk in cat.get("competences") or []:
                    if isinstance(sk, dict) and "_bar_pct" not in sk:
                        sk["_bar_pct"] = _skill_bar_pct(sk.get("niveau"))
        if st == "grille_projets":
            coerce_mapping_list(sec.get("projets") or [])


_TEMPLATE = jinja_env.from_string(
    """<!DOCTYPE html>
<html lang="{{ lang|e }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title|e }}</title>
  <link href="{{ fonts_url }}" rel="stylesheet">
  <style>
:root { {% for k,v in paleta.items() %}--{{ k }}: {{ v }};{% endfor %}
  --fd: "{{ fd }}", serif; --fm: "{{ fm }}", monospace; --fc: "{{ fc }}", sans-serif;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--fc);background:var(--bg);color:var(--white);line-height:1.6}
body::before{content:"";position:fixed;inset:0;background-image:linear-gradient(rgba(0,229,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,.04) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}
main,header,footer{position:relative;z-index:1}
a{color:var(--cyan)}
.container{max-width:960px;margin:0 auto;padding:0 20px}
header{padding:16px 0;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(6,8,16,.85);backdrop-filter:blur(8px);z-index:20}
.nav-row{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
.logo{font-family:var(--fm);font-size:.95rem;color:var(--cyan);display:inline-flex;align-items:center;gap:8px}
.logo img{display:block;height:28px;width:auto}
nav{display:flex;gap:16px;flex-wrap:wrap;font-size:.85rem}
nav a{opacity:.8}
.hero{padding:80px 0 48px}
.hero-visual{margin-top:28px;border-radius:12px;overflow:hidden;border:1px solid var(--border);max-width:640px}
.hero-visual img{width:100%;height:auto;display:block;vertical-align:middle}
.hero h1{font-family:var(--fd);font-size:clamp(2.2rem,5vw,3.5rem);line-height:1.1;margin-bottom:12px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start}
@media(max-width:900px){.grid-2{grid-template-columns:1fr}}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px}
.skills-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.tab{padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--white);cursor:pointer;font-size:.85rem}
.tab.active{border-color:var(--cyan);color:var(--cyan)}
.skill-bar{height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin:6px 0 12px}
.skill-bar > i{display:block;height:100%;background:linear-gradient(90deg,var(--cyan),var(--violet));transform-origin:left}
.projects{display:grid;gap:20px}
.project{display:grid;grid-template-columns:140px 1fr;gap:16px;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface2)}
@media(max-width:640px){.project{grid-template-columns:1fr}}
.timeline{border-left:2px solid var(--border);padding-left:20px;margin-left:8px}
.timeline-item{margin-bottom:24px}
.section-kicker{display:block;color:var(--violet);font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px}
.contact-form{display:grid;gap:12px;max-width:480px}
.contact-form input,.contact-form textarea{width:100%;padding:12px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--white);font-family:var(--fc)}
footer{padding:40px 0;border-top:1px solid var(--border);font-size:.85rem;color:var(--muted);text-align:center}
footer .social a{color:var(--cyan)}
.fade{opacity:0;transform:translateY(12px);transition:.5s}
.fade.show{opacity:1;transform:none}
  </style>
</head>
<body>
{% if nav %}
<header>
  <div class="container nav-row">
    {% if nav._logo_src %}
    <a href="#top" class="logo"><img src="{{ nav._logo_src|e }}" alt="{{ title|e }}"></a>
    {% else %}
    <a href="#top" class="logo">{{ (nav._logo_text or title)|e }}</a>
    {% endif %}
    <nav>
      {% for l in nav.liens or [] %}
      {% if l is mapping %}
      <a href="{{ (l.href or l.url or '#')|e }}">{{ (l.label or l.texte or l.text or '')|e }}</a>
      {% else %}
      <a href="#{{ l|e }}">{{ l|e }}</a>
      {% endif %}
      {% endfor %}
    </nav>
    {% if nav.cta %}
      {% if nav.cta is mapping %}
      <a href="{{ (nav.cta.href or nav.cta.url or '#contact')|e }}" style="border:1px solid var(--cyan);padding:8px 14px;border-radius:8px;font-size:.85rem">{{ (nav.cta.label or nav.cta.texte or '')|e }}</a>
      {% else %}
      <a href="#contact" style="border:1px solid var(--cyan);padding:8px 14px;border-radius:8px;font-size:.85rem">{{ nav.cta|e }}</a>
      {% endif %}
    {% endif %}
  </div>
</header>
{% endif %}
<main id="top">
{% for s in sections %}
{% if s.type == 'navigation' %}
{% elif s.type == 'hero' %}
<section class="hero container fade" id="{{ s.id|e }}">
  {% if s.label %}<p style="color:var(--green);font-size:.85rem;margin-bottom:8px">{{ s.label|e }}</p>{% endif %}
  <h1>
    {% if s.titre_lignes %}
      {% for line in s.titre_lignes %}
        {% if line is mapping %}<span style="display:block">{{ (line.text or line.titre or line.line)|e }}</span>
        {% else %}<span style="display:block">{{ line|e }}</span>{% endif %}
      {% endfor %}
    {% elif s.titre %}
      {% for line in s.titre.splitlines() %}
        {% if line.strip() %}<span style="display:block">{{ line|e }}</span>{% endif %}
      {% endfor %}
    {% endif %}
  </h1>
  <p style="color:var(--muted);max-width:520px;margin:16px 0">{{ (s.sous_titre or s.subtitulo or '')|e }}</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap">
    {% for b in s.boutons or [] %}
      {% if b is mapping %}
      <a href="{{ (b.href or b.url or '#')|e }}" style="padding:10px 18px;border-radius:8px;font-weight:600;{% if b.primaire or b.primary or b.primario %}background:var(--cyan);color:var(--bg);{% else %}border:1px solid var(--cyan);color:var(--cyan);background:transparent{% endif %}">{{ (b.label or b.texte or '')|e }}</a>
      {% else %}
      <a href="#projets" style="background:var(--cyan);color:var(--bg);padding:10px 18px;border-radius:8px;font-weight:600">{{ b|e }}</a>
      {% endif %}
    {% endfor %}
  </div>
  {% if s.stats %}
  <div style="display:flex;gap:24px;margin-top:28px;font-size:.9rem;flex-wrap:wrap">
    {% for st in s.stats or [] %}
    {% if st is mapping %}
    <div><strong style="color:var(--cyan)">{{ (st.valeur or st.valor or st.value or '')|e }}</strong><br><span style="color:var(--muted)">{{ (st.label or st.legende or '')|e }}</span></div>
    {% endif %}
    {% endfor %}
  </div>
  {% endif %}
  {% if s.image or s.hero_image %}
  <div class="hero-visual">
    <img src="{{ (s.image or s.hero_image)|e }}" alt="">
  </div>
  {% endif %}
</section>
{% elif s.type == 'a_propos' %}
<section class="container fade" id="{{ s.id|e }}" style="padding:48px 0">
  {% if s._kicker %}<span class="section-kicker">{{ s._kicker|e }}</span>{% endif %}
  <h2 style="font-family:var(--fd);font-size:1.8rem;margin:8px 0">{{ s.titre|e }}</h2>
  <div class="grid-2" style="margin-top:24px">
    <div>
      {% if s.photo %}<img src="{{ s.photo|e }}" alt="" style="border-radius:12px;border:1px solid var(--border);max-width:100%">{% endif %}
    </div>
    <div>
      {% for p in s.biographie or [] %}<p style="margin-bottom:12px;color:var(--muted)">{{ p.texto|e if p is mapping else p|e }}</p>{% endfor %}
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
        {% for t in s.tags_tech or s.tags or s.areas or [] %}<span style="font-size:.75rem;border:1px solid var(--border);padding:4px 8px;border-radius:6px">{{ t.label|e if t is mapping else t|e }}</span>{% endfor %}
      </div>
    </div>
  </div>
</section>
{% elif s.type == 'competences_onglets' %}
<section class="container fade" id="{{ s.id|e }}" style="padding:48px 0">
  {% if s._kicker %}<span class="section-kicker">{{ s._kicker|e }}</span>{% endif %}
  <h2 style="font-family:var(--fd);font-size:1.8rem;margin:8px 0">{{ s.titre|e }}</h2>
  <div class="skills-tabs" id="tabs">
    {% for c in s.categories or [] %}<button type="button" class="tab {% if loop.first %}active{% endif %}" data-tab="{{ (c.id or loop.index)|e }}">{{ c.label|e }}</button>{% endfor %}
  </div>
  {% for c in s.categories or [] %}
  {% set panel_id = c.id or loop.index %}
  <div class="tab-panel" id="panel-{{ panel_id|e }}" style="display:{% if loop.first %}block{% else %}none{% endif %}">
    {% for sk in c.competences or [] %}
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>{% if sk._icone_html %}<span aria-hidden="true">{{ sk._icone_html }}</span> {% endif %}{{ (sk.nom or sk.nome or sk.name)|e }}</span><span>{{ (sk.niveau_label or sk.niveau or '')|e }}</span></div>
      <div class="skill-bar"><i style="width:{{ sk._bar_pct|default(80) }}%"></i></div>
    </div>
    {% endfor %}
  </div>
  {% endfor %}
</section>
{% elif s.type == 'grille_projets' %}
<section class="container fade" id="{{ s.id|e }}" style="padding:48px 0">
  {% if s._kicker %}<span class="section-kicker">{{ s._kicker|e }}</span>{% endif %}
  <h2 style="font-family:var(--fd);font-size:1.8rem;margin:8px 0">{{ s.titre|e }}</h2>
  <div class="projects" style="margin-top:24px">
    {% for p in s.projets or [] %}
    <div class="project">
      {% if p.image %}<img src="{{ p.image|e }}" alt="" width="140" height="120" style="object-fit:cover">{% endif %}
      <div style="padding:16px">
        {% if p.numero %}<small style="color:var(--muted);font-variant-numeric:tabular-nums">{{ p.numero|string|trim|e }}</small>{% endif %}
        <h3 style="font-size:1.1rem;margin:4px 0">{{ (p.nom or p.titulo or p.title)|e }}</h3>
        <p style="font-size:.85rem;color:var(--muted)">{{ (p.description or p.descricao or '')|e }}</p>
      </div>
    </div>
    {% endfor %}
  </div>
</section>
{% elif s.type == 'timeline' %}
<section class="container fade" id="{{ s.id|e }}" style="padding:48px 0">
  {% if s._kicker %}<span class="section-kicker">{{ s._kicker|e }}</span>{% endif %}
  <h2 style="font-family:var(--fd);font-size:1.8rem;margin:8px 0">{{ s.titre|e }}</h2>
  <div class="timeline" style="margin-top:24px">
    {% for ex in s.experiences or [] %}
    <div class="timeline-item">
      <strong style="color:var(--cyan)">{{ (ex.periode or ex.periodo or '')|e }}</strong>
      <p style="font-weight:600">{{ (ex.poste or ex.cargo or '')|e }} \u2014 {{ (ex.entreprise or ex.empresa or '')|e }}</p>
      <p style="font-size:.9rem;color:var(--muted)">{{ (ex.description or ex.descricao or '')|e }}</p>
    </div>
    {% endfor %}
  </div>
</section>
{% elif s.type == 'contact' %}
<section class="container fade" id="{{ s.id|e }}" style="padding:48px 0">
  {% if s._kicker %}<span class="section-kicker">{{ s._kicker|e }}</span>{% endif %}
  <h2 style="font-family:var(--fd);font-size:1.8rem;margin:8px 0">{{ s.titre|e }}</h2>
  <p style="color:var(--muted);margin-bottom:20px">{{ (s.intro or '')|e }}</p>
  <div class="grid-2">
    <div>
      {% for inf in s.informations or [] %}
      <p style="margin-bottom:10px">{% if inf._icone_html %}<span aria-hidden="true">{{ inf._icone_html }}</span> {% endif %}<span style="opacity:.7">{{ (inf.label or inf.titulo)|e }}:</span> {{ (inf.valeur or inf.valor or inf.value)|e }}</p>
      {% endfor %}
    </div>
    <form class="contact-form" onsubmit="event.preventDefault();alert('{{ form_toast|e }}');">
      {% for ch in (s.formulaire.champs if s.formulaire else []) %}
      {% set ph = (ch.placeholder or ch.label or ch.titulo or '') %}
      {% if ch.type == 'textarea' %}
      <textarea rows="4" placeholder="{{ ph|e }}"></textarea>
      {% else %}
      <input type="{{ (ch.type or 'text')|e }}" placeholder="{{ ph|e }}">
      {% endif %}
      {% endfor %}
      {% set btn_label = 'Envoyer' %}
      {% if s.formulaire and s.formulaire.bouton %}
        {% if s.formulaire.bouton is mapping %}
          {% set btn_label = s.formulaire.bouton.label or s.formulaire.bouton.texte or 'Envoyer' %}
        {% else %}
          {% set btn_label = s.formulaire.bouton %}
        {% endif %}
      {% endif %}
      <button type="submit" style="background:linear-gradient(90deg,var(--cyan),var(--violet));border:none;color:var(--bg);padding:12px;font-weight:600;border-radius:8px;cursor:pointer">{{ btn_label|e }}</button>
    </form>
  </div>
</section>
{% elif s.type == 'footer' %}
<footer id="{{ (s.id or 'footer')|e }}">
  <div class="container">
    {% if s._footer_logo_src %}
    <p><img src="{{ s._footer_logo_src|e }}" alt="" style="height:24px;margin:0 auto;display:block"></p>
    {% elif s.logo %}
    <p>{{ s.logo|e }}</p>
    {% endif %}
    {% if s.description %}<p style="margin-top:14px;max-width:560px;margin-left:auto;margin-right:auto;line-height:1.55">{{ s.description|e }}</p>{% endif %}
    {% if s.reseaux %}
    <div class="social" style="display:flex;gap:18px;justify-content:center;margin-top:16px;flex-wrap:wrap">
      {% for r in s.reseaux %}
      <a href="{{ (r.href or r.url or '#')|e }}">{{ (r.label or r.nom or r.texte or 'Lien')|e }}</a>
      {% endfor %}
    </div>
    {% endif %}
    {% if s.copyright %}<p style="margin-top:14px;font-size:.8rem">{{ s.copyright|e }}</p>{% endif %}
  </div>
</footer>
{% endif %}
{% endfor %}
</main>
<script>
(function(){
  document.querySelectorAll('.tab').forEach(function(btn){
    btn.addEventListener('click',function(){
      var id=btn.getAttribute('data-tab');
      document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('active');});
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(function(p){p.style.display='none';});
      var el=document.getElementById('panel-'+id);if(el)el.style.display='block';
    });
  });
  var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting)e.target.classList.add('show');});},{threshold:0.1});
  document.querySelectorAll('.fade').forEach(function(el){io.observe(el);});
})();
</script>
</body>
</html>"""
)


def render_portfolio(site: dict[str, Any]) -> str:
    site = dict(site)
    sections = list(site.get("sections") or [])
    _deep_fix_strings(sections)
    _normalize_portfolio_sections(sections)
    site["sections"] = sections

    design = site.get("design") or {}
    paleta = _normalize_palette(design.get("palette") or {})
    tip = design.get("typographie") or {}
    fd = font_query_name(tip.get("display"))
    fm = font_query_name(tip.get("mono"))
    fc = font_query_name(tip.get("corps"))
    fonts_url = google_fonts_link(tip.get("display"), tip.get("mono"), tip.get("corps"))

    nav_sec = next(
        (s for s in sections if (s.get("type") or s.get("tipo")) in ("navigation", "navegacao", "nav")),
        None,
    )
    title = site.get("nom") or "Portfolio"
    nav: dict[str, Any] | None = None
    if nav_sec:
        raw_links = nav_sec.get("liens") or nav_sec.get("links") or []
        coerce_mapping_list(raw_links)
        logo_raw = nav_sec.get("logo")
        nav = {
            "logo": logo_raw,
            "liens": raw_links,
            "cta": nav_sec.get("cta"),
            "_logo_src": str(logo_raw).strip() if _looks_like_image_path(logo_raw) else None,
            "_logo_text": (None if _looks_like_image_path(logo_raw) else (str(logo_raw).strip() if logo_raw else None)) or title,
        }

    _assign_nav_anchors_to_sections(sections, nav)
    _enrich_content_sections(sections)

    lang = site.get("langue") or "fr"
    formulaire = None
    for s in sections:
        if s.get("type") == "contact" and s.get("formulaire"):
            formulaire = s["formulaire"]
            break
    raw_toast = (formulaire or {}).get("toast_succes") or "Message envoyé"
    form_toast = _fix_mojibake(str(raw_toast))

    return _TEMPLATE.render(
        lang=lang,
        title=title,
        fonts_url=fonts_url,
        paleta=paleta,
        fd=fd,
        fm=fm,
        fc=fc,
        nav=nav,
        sections=sections,
        formulaire=formulaire,
        form_toast=form_toast,
    )
