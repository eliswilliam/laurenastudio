"""Rendu single-page pour le framework hotel-reserva (JSON `site`)."""
from __future__ import annotations

from typing import Any

from app.services.site_template_render._utils import font_query_name, google_fonts_link, jinja_env

_TEMPLATE = jinja_env.from_string(
    """<!DOCTYPE html>
<html lang="{{ lang|e }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title|e }}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="{{ fonts_url }}" rel="stylesheet">
  <style>
:root {
  {% for k,v in paleta.items() %}--{{ k }}: {{ v }};{% endfor %}
  --font-d: "{{ fd }}", serif;
  --font-c: "{{ fc }}", sans-serif;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-c);background:var(--cream);color:var(--dark);line-height:1.6}
a{color:var(--brown);text-decoration:none}
img{max-width:100%;display:block;border-radius:12px}
.container{max-width:1120px;margin:0 auto;padding:0 20px}
header{position:sticky;top:0;z-index:50;background:rgba(253,250,246,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--sand)}
.header-inner{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:14px 0}
.logo{font-family:var(--font-d);font-weight:700;font-size:1.25rem;color:var(--dark)}
nav{display:flex;gap:18px;flex-wrap:wrap;align-items:center}
nav a{font-size:.9rem;font-weight:500;color:var(--muted)}
nav a:hover{color:var(--gold)}
.btn{display:inline-block;padding:12px 18px;border-radius:10px;font-weight:600;font-size:.95rem;cursor:pointer;border:none}
.btn-primary{background:var(--gold);color:var(--dark)}
.btn-outline{background:transparent;border:2px solid var(--gold);color:var(--dark)}
.hero{ padding:72px 0 48px; }
.hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center}
@media(max-width:900px){.hero-grid{grid-template-columns:1fr}}
.hero h1{font-family:var(--font-d);font-size:clamp(2rem,4vw,2.8rem);color:var(--dark);margin-bottom:16px}
.tag{display:inline-block;background:var(--sand);color:var(--brown);padding:6px 12px;border-radius:999px;font-size:.8rem;font-weight:600;margin-bottom:12px}
.hero-sub{color:var(--muted);margin-bottom:18px;font-size:1.05rem}
.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}
.badge-row{display:flex;align-items:center;gap:10px;margin-top:20px;font-size:.9rem;color:var(--muted)}
.search-form{background:var(--white);padding:24px;border-radius:16px;box-shadow:0 8px 40px rgba(26,18,9,.08);margin:48px 0}
.search-form h3{display:none}
.grid{display:grid;gap:20px}
.grid-2{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.grid-4{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.card{background:var(--white);border-radius:14px;overflow:hidden;border:1px solid var(--sand)}
.card-body{padding:16px}
.destino-card h3{font-family:var(--font-d);font-size:1.1rem;margin-bottom:4px}
.hotel-card .price{font-size:1.5rem;font-weight:700;color:var(--gold)}
.features{padding:64px 0}
.features h2,.section-title{font-family:var(--font-d);font-size:clamp(1.6rem,3vw,2rem);text-align:center;margin-bottom:8px}
.feature-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;margin-top:28px}
.feature{background:var(--white);padding:20px;border-radius:14px;border:1px solid var(--sand)}
.testimonials{padding:64px 0;background:var(--sand)}
.testimonial-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:28px}
.t-card{background:var(--white);padding:20px;border-radius:14px}
.newsletter{padding:56px 0;text-align:center;background:linear-gradient(135deg,var(--gold_light),var(--gold))}
.newsletter input{padding:14px 16px;border-radius:10px;border:1px solid var(--sand);width:min(400px,100%);margin:auto 8px auto 0}
footer{padding:48px 0;background:var(--dark);color:var(--cream);font-size:.875rem}
footer a{color:var(--gold_light)}
.footer-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:28px;margin-top:20px}
.fade-up{opacity:0;transform:translateY(16px);transition:opacity .5s ease,transform .5s ease}
.fade-up.visible{opacity:1;transform:none}
.modal{position:fixed;inset:0;background:rgba(26,18,9,.55);display:none;align-items:center;justify-content:center;z-index:100;padding:20px}
.modal.open{display:flex}
.modal-box{background:var(--white);padding:28px;border-radius:16px;max-width:480px;width:100%;max-height:90vh;overflow:auto}
.modal-box h3{margin-bottom:16px;font-family:var(--font-d)}
.modal-box label{display:block;margin:10px 0 4px;font-size:.85rem}
.modal-box input,.modal-box select{width:100%;padding:10px;border-radius:8px;border:1px solid var(--sand)}
  </style>
</head>
<body>
{% if nav %}
<header>
  <div class="container header-inner">
    <a href="#top" class="logo">{{ nav.logo|e }}</a>
    <nav>
      {% for link in nav.links %}
      <a href="{{ nav.hrefs[loop.index0] if nav.hrefs and loop.index0 < nav.hrefs|length else '#' }}">{{ link|e }}</a>
      {% endfor %}
    </nav>
    {% if nav.cta %}<a href="#busca" class="btn btn-primary">{{ nav.cta|e }}</a>{% endif %}
  </div>
</header>
{% endif %}
<main id="top">
{% for s in secoes %}
{% if s.tipo == 'navegacao' %}
{% elif s.tipo == 'hero' %}
<section class="hero fade-up" id="{{ s.id|e }}">
  <div class="container hero-grid">
    <div>
      {% if s.tag %}<span class="tag">{{ s.tag|e }}</span>{% endif %}
      <h1>{{ s.titulo|e }}</h1>
      <p class="hero-sub">{{ s.subtitulo|e }}</p>
      <div class="hero-actions">
        {% for b in s.botoes or [] %}
        <a class="btn {% if loop.first %}btn-primary{% else %}btn-outline{% endif %}" href="#busca">{{ b|e }}</a>
        {% endfor %}
      </div>
      {% if s.badge %}
      <div class="badge-row">
        <span>★ {{ s.badge.nota }}/{{ s.badge.estrelas }}</span>
        <span>{{ s.badge.avaliacoes|e }}</span>
      </div>
      {% endif %}
    </div>
    <div>
      {% if s.imagem %}<img src="{{ s.imagem|e }}" alt="{{ s.titulo|e }}" width="640" height="480">{% endif %}
    </div>
  </div>
</section>
{% elif s.tipo == 'formulario_busca' %}
<section class="search-form fade-up" id="{{ s.id|e }}">
  <div class="container">
    <div class="grid grid-2">
      {% for c in s.campos or [] %}
      <div>
        <label style="display:block;font-size:.85rem;margin-bottom:4px">{{ c.nome|e }}</label>
        {% if c.tipo == 'select' %}
        <select class="btn" style="width:100%;background:var(--white);border:1px solid var(--sand);padding:12px;">
          {% for o in c.opcoes or [] %}<option>{{ o|e }}</option>{% endfor %}
        </select>
        {% elif c.tipo == 'date' %}
        <input type="date" id="in-{{ loop.index }}" style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--sand)">
        {% else %}
        <input type="text" placeholder="{{ c.placeholder|e if c.placeholder else '' }}" style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--sand)">
        {% endif %}
      </div>
      {% endfor %}
    </div>
    <div style="margin-top:16px;text-align:center">
      <button type="button" class="btn btn-primary" onclick="document.getElementById('modal-reserva').classList.add('open')">{{ s.botao|e }}</button>
    </div>
  </div>
</section>
{% elif s.tipo == 'grid_destinos' %}
<section class="fade-up" id="{{ s.id|e }}" style="padding:48px 0">
  <div class="container">
    {% if s.tag %}<span class="tag">{{ s.tag|e }}</span>{% endif %}
    <h2 class="section-title">{{ s.titulo|e }}</h2>
    <div class="grid grid-4" style="margin-top:24px">
      {% for d in s.destinos or [] %}
      <div class="card destino-card">
        {% if d.imagem %}<img src="{{ d.imagem|e }}" alt="{{ d.cidade|e }}" height="200" style="object-fit:cover;width:100%">{% endif %}
        <div class="card-body">
          <h3>{{ d.cidade|e }}</h3>
          <small style="color:var(--muted)">{{ d.hoteis }} hotéis</small>
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
</section>
{% elif s.tipo == 'grid_produtos' %}
<section class="fade-up" id="{{ s.id|e }}" style="padding:48px 0">
  <div class="container">
    {% if s.tag %}<span class="tag">{{ s.tag|e }}</span>{% endif %}
    <h2 class="section-title">{{ s.titulo|e }}</h2>
    <div class="grid grid-4" style="margin-top:24px">
      {% for h in s.hoteis or [] %}
      <div class="card hotel-card">
        {% if h.imagem %}<img src="{{ h.imagem|e }}" alt="{{ h.nome|e }}" height="200" style="object-fit:cover;width:100%">{% endif %}
        <div class="card-body">
          <span style="font-size:.75rem;background:var(--sand);padding:2px 8px;border-radius:4px">{{ h.badge|e }}</span>
          <h3 style="font-family:var(--font-d);margin:8px 0">{{ h.nome|e }}</h3>
          <p style="font-size:.85rem;color:var(--muted)">{{ h.localizacao|e }}</p>
          <p class="price">R$ {{ h.preco_por_noite }} <small style="font-size:.8rem;font-weight:400">/noite</small></p>
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
</section>
{% elif s.tipo == 'features' %}
<section class="features fade-up" id="{{ s.id|e }}">
  <div class="container">
    {% if s.tag %}<p style="text-align:center;color:var(--gold);font-weight:600;font-size:.85rem">{{ s.tag|e }}</p>{% endif %}
    <h2 class="section-title">{{ s.titulo|e }}</h2>
    {% if s.stat_destaque %}<p style="text-align:center;color:var(--muted)">{{ s.stat_destaque|e }}</p>{% endif %}
    <div class="feature-grid">
      {% for it in s.get('items', []) %}
      <div class="feature">
        <div style="font-size:1.5rem">{{ it.icone|e }}</div>
        <h4 style="margin:8px 0;font-family:var(--font-d)">{{ it.titulo|e }}</h4>
        <p style="font-size:.9rem;color:var(--muted)">{{ it.descricao|e }}</p>
      </div>
      {% endfor %}
    </div>
  </div>
</section>
{% elif s.tipo == 'testimonials' %}
<section class="testimonials fade-up" id="{{ s.id|e }}">
  <div class="container">
    {% if s.tag %}<p style="text-align:center;color:var(--brown);font-weight:600">{{ s.tag|e }}</p>{% endif %}
    <h2 class="section-title">{{ s.titulo|e }}</h2>
    <div class="testimonial-grid">
      {% for t in s.depoimentos or [] %}
      <div class="t-card">
        <p style="margin-bottom:12px;font-size:.95rem">{{ t.texto|e }}</p>
        <div style="display:flex;align-items:center;gap:10px">
          {% if t.avatar %}<img src="{{ t.avatar|e }}" width="40" height="40" style="border-radius:50%" alt="">{% endif %}
          <div><strong>{{ t.autor|e }}</strong><br><small>{{ t.cidade|e }}</small></div>
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
</section>
{% elif s.tipo == 'newsletter' %}
<section class="newsletter fade-up" id="{{ s.id|e }}">
  <div class="container">
    <h2 style="font-family:var(--font-d);margin-bottom:8px">{{ s.titulo|e }}</h2>
    <p style="opacity:.9;margin-bottom:16px">{{ s.subtitulo|e }}</p>
    <form onsubmit="event.preventDefault();alert('Inscrito!');" style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px">
      <input type="email" placeholder="{{ s.placeholder|e }}" required>
      <button type="submit" class="btn btn-primary">{{ s.botao|e }}</button>
    </form>
  </div>
</section>
{% elif s.tipo == 'footer' %}
<footer id="{{ s.id|e }}">
  <div class="container">
    <div style="font-family:var(--font-d);font-size:1.2rem;margin-bottom:8px">{{ s.logo|e }}</div>
    <p style="opacity:.85;max-width:520px">{{ s.descricao|e }}</p>
    <div class="footer-grid">
      {% for col in s.colunas or [] %}
      <div>
        <strong style="color:var(--gold)">{{ col.titulo|e }}</strong>
        {% for lk in col.links or [] %}
        <div style="margin-top:8px"><a href="#">{% if lk is string %}{{ lk|e }}{% else %}{{ lk.label|e }}{% endif %}</a></div>
        {% endfor %}
      </div>
      {% endfor %}
    </div>
    <p style="margin-top:28px;text-align:center;opacity:.7">{{ s.copyright|e }}</p>
  </div>
</footer>
{% endif %}
{% endfor %}
</main>
{% if modal %}
<div id="modal-reserva" class="modal" onclick="if(event.target===this)this.classList.remove('open')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <h3>{{ modal.titulo|e }}</h3>
    {% for c in modal.campos or [] %}
    <label>{{ c.nome|e }}</label>
    {% if c.tipo == 'select' %}
    <select>{% for o in c.opcoes or [] %}<option>{{ o|e }}</option>{% endfor %}</select>
    {% else %}
    <input type="{{ c.tipo|e }}">
    {% endif %}
    {% endfor %}
    <button type="button" class="btn btn-primary" style="margin-top:16px;width:100%" onclick="document.getElementById('modal-reserva').classList.remove('open');alert('Reserva simulada!')">{{ modal.botao_confirmar|e }}</button>
  </div>
</div>
{% endif %}
<script>
(function(){
  var els=document.querySelectorAll('.fade-up');
  var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting)e.target.classList.add('visible');});},{threshold:0.12});
  els.forEach(function(el){io.observe(el);});
  document.querySelectorAll('input[type=date]').forEach(function(el){el.min=new Date().toISOString().split('T')[0];});
})();
</script>
</body>
</html>"""
)


def _nav_hrefs(secoes: list[dict[str, Any]]) -> list[str]:
    ids = [s.get("id") for s in secoes if s.get("id") and s.get("tipo") != "navegacao"]
    return ["#" + str(i) for i in ids] if ids else []


_DEFAULT_HOTEL_PAL: dict[str, str] = {
    "cream": "#F5EFE4",
    "sand": "#E8DCCC",
    "brown": "#5C3D2E",
    "dark": "#1A1209",
    "gold": "#C9924B",
    "gold_light": "#E8B97A",
    "white": "#FDFAF6",
    "muted": "#8A7565",
}


def render_hotel(site: dict[str, Any]) -> str:
    design = site.get("design") or {}
    paleta = {**_DEFAULT_HOTEL_PAL, **(design.get("paleta") or {})}
    tip = design.get("tipografia") or {}
    secoes = site.get("secoes") or []
    nav_sec = next((s for s in secoes if s.get("tipo") == "navegacao"), None)
    nav_hrefs = _nav_hrefs(secoes)
    nav: dict[str, Any] | None = None
    if nav_sec:
        links_raw = nav_sec.get("links") or []
        if links_raw and isinstance(links_raw[0], dict):
            links = [str(x.get("label") or "") for x in links_raw if isinstance(x, dict)]
        else:
            links = [str(x) for x in links_raw]
        hrefs = [nav_hrefs[i] if i < len(nav_hrefs) else "#" for i in range(len(links))]
        nav = {
            "logo": nav_sec.get("logo") or site.get("nome") or "Hotel",
            "links": links,
            "hrefs": hrefs,
            "cta": nav_sec.get("cta"),
        }

    fd = font_query_name(tip.get("display"))
    fc = font_query_name(tip.get("corpo"))
    fonts_url = google_fonts_link(tip.get("display"), tip.get("corpo"))

    title = site.get("nome") or "Hotel"
    lang = site.get("idioma") or "pt-BR"
    modal = site.get("modal_reserva")

    return _TEMPLATE.render(
        lang=lang,
        title=title,
        fonts_url=fonts_url,
        paleta=paleta,
        fd=fd,
        fc=fc,
        nav=nav,
        secoes=secoes,
        modal=modal,
    )
