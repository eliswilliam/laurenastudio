"""Rendu single-page pour le framework ecommerce (JSON `site`)."""
from __future__ import annotations

from typing import Any

from app.services.site_template_render._utils import (
    coerce_mapping_list,
    font_query_name,
    google_fonts_link,
    jinja_env,
)

# Bandeau défilant : contenu figé côté rendu (l’IA ne peut pas le modifier visuellement).
_CANONICAL_TICKER_MESSAGES: list[dict[str, str]] = [
    {"label": "Frete grátis em compras acima de R$299"},
    {"label": "Novidades todas as semanas"},
    {"label": "Trocas em até 30 dias"},
]

_DEFAULT_PAL = {
    "bg": "#0A0A0A",
    "surface": "#111111",
    "surface2": "#181818",
    "border": "#222222",
    "lime": "#C8FF00",
    "lime_dim": "#9FCC00",
    "white": "#F0F0F0",
    "muted": "#666666",
    "muted2": "#444444",
    "red": "#FF3B3B",
}

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
  --fd: "{{ fd }}", sans-serif; --fc: "{{ fc }}", sans-serif;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--fc);background:var(--bg);color:var(--white);line-height:1.5}
a{color:var(--lime);text-decoration:none}
img{max-width:100%;border-radius:8px;display:block}
.container{max-width:1200px;margin:0 auto;padding:0 20px}
.ticker{overflow:hidden;background:var(--lime);color:var(--bg);padding:8px 0;font-weight:700;font-size:.75rem;letter-spacing:.06em}
.ticker-inner{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 16px;align-items:center;text-align:center}
.tick-sep{opacity:.55}
header{padding:16px 0;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(10,10,10,.9);z-index:40}
.header-row{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
.logo{font-family:var(--fd);font-size:1.4rem;font-weight:700;letter-spacing:.08em}
.nav-cats{display:flex;gap:14px;flex-wrap:wrap;font-size:.85rem}
.hero{padding:56px 0;display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:center}
@media(max-width:900px){.hero{grid-template-columns:1fr}}
.hero h1{font-family:var(--fd);font-size:clamp(2rem,5vw,3.2rem);text-transform:uppercase;line-height:1}
.filter-bar{display:flex;gap:8px;flex-wrap:wrap;padding:16px 0;border-bottom:1px solid var(--border)}
.filter-bar button,.chip{background:var(--surface2);border:1px solid var(--border);color:var(--white);padding:8px 14px;border-radius:6px;cursor:pointer;font-size:.8rem}
.chip.active,.filter-bar button:hover{border-color:var(--lime);color:var(--lime)}
.products{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;padding:32px 0}
.product{background:var(--surface);border-radius:12px;overflow:hidden;border:1px solid var(--border);position:relative}
.product .meta{padding:12px}
.product .price{font-weight:700;color:var(--lime)}
.badge-pos{position:absolute;top:10px;left:10px;background:var(--red);color:#fff;font-size:.65rem;padding:2px 8px;border-radius:4px;font-weight:700}
.banner-sale{padding:48px 0;background:linear-gradient(135deg,var(--surface2),var(--surface));text-align:center}
.brands{display:flex;flex-wrap:wrap;gap:20px;justify-content:center;padding:32px 0;opacity:.6;font-weight:700;font-size:.85rem;letter-spacing:.1em}
.editorial{display:grid;grid-template-columns:2fr 1fr;gap:16px;padding:32px 0}
@media(max-width:900px){.editorial{grid-template-columns:1fr}}
.features-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;padding:40px 0;border-top:1px solid var(--border)}
footer{padding:40px 0;border-top:1px solid var(--border);font-size:.8rem;color:var(--muted)}
.footer-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:24px}
.drawer{position:fixed;top:0;right:0;width:min(400px,100%);height:100%;background:var(--surface);border-left:1px solid var(--border);transform:translateX(100%);transition:transform .3s;z-index:100;padding:20px;overflow:auto}
.drawer.open{transform:translateX(0)}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;z-index:99}
.overlay.show{display:block}
.btn{padding:12px 20px;background:var(--lime);color:var(--bg);border:none;font-weight:700;cursor:pointer;border-radius:8px;width:100%;margin-top:12px}
  </style>
</head>
<body>
{% if ticker %}
<div class="ticker"><div class="ticker-inner">
{% for m in ticker %}<span class="tick-i">{{ m.label|e if m is mapping else m|e }}</span>{% if not loop.last %}<span class="tick-sep" aria-hidden="true"> Â· </span>{% endif %}{% endfor %}
</div></div>
{% endif %}
<header>
  <div class="container header-row">
    <a href="#top" class="logo">{{ nome|e }}</a>
    {% if nav_cats %}<nav class="nav-cats">{% for c in nav_cats %}{% if c is mapping %}<a href="{{ (c.href or c.url or '#produtos')|e }}">{{ (c.label or c.nome or '')|e }}</a>{% else %}<a href="#produtos">{{ c|e }}</a>{% endif %}{% endfor %}</nav>{% endif %}
    <div>
      <button type="button" style="background:var(--surface2);border:1px solid var(--border);color:var(--white);padding:8px 12px;border-radius:6px;cursor:pointer" onclick="document.getElementById('cart').classList.add('open');document.getElementById('ov').classList.add('show')">Carrinho (<span id="cc">0</span>)</button>
    </div>
  </div>
</header>
<main id="top">
{% for s in secoes %}
{% if s.tipo == 'banner_animado' or s.tipo == 'navegacao' %}
{% elif s.tipo == 'hero' %}
<section class="hero container" id="{{ s.id|e }}">
  <div>
    {% if s.label_colecao or s.label %}<p style="color:var(--lime);font-size:.75rem;margin-bottom:8px">{{ (s.label_colecao or s.label)|e }}</p>{% endif %}
    <h1>{{ s.titulo|e }}</h1>
    <p style="color:var(--muted);margin:16px 0">{{ (s.subtitulo or s.descricao or '')|e }}</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      {% for b in s.botoes or [] %}
      {% if b is mapping %}
      <a href="{{ (b.href or b.url or '#produtos')|e }}" style="padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;{% if b.primario or b.primary or b.primaire %}background:var(--lime);color:var(--bg);border:none{% else %}border:1px solid var(--lime);color:var(--lime);background:transparent{% endif %}">{{ (b.label or b.texto or '')|e }}</a>
      {% else %}
      <a href="#produtos" style="border:1px solid var(--lime);padding:10px 16px;border-radius:6px;color:var(--lime)">{{ b.label|e if b is mapping else b|e }}</a>
      {% endif %}
      {% endfor %}
    </div>
    {% if s.stats %}
    <div style="display:flex;gap:24px;margin-top:24px;font-size:.85rem;flex-wrap:wrap">
      {% for st in s.stats or [] %}
      {% if st is mapping %}
      <div><strong style="color:var(--lime)">{{ (st.valor or st.value or '')|e }}</strong><br><span style="color:var(--muted)">{{ (st.label or st.legenda or '')|e }}</span></div>
      {% endif %}
      {% endfor %}
    </div>
    {% endif %}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    {% if s.imagem %}<img src="{{ s.imagem|e }}" alt="" style="grid-column:span 2">{% endif %}
  </div>
</section>
{% elif s.tipo == 'barra_filtros' %}
<section class="container" id="{{ s.id|e }}">
  <div class="filter-bar" id="filters">
    {% for f in s.filtros or [] %}<button type="button" class="chip" data-f="{{ f.label|e if f is mapping else f|e }}">{{ f.label|e if f is mapping else f|e }}</button>{% endfor %}
  </div>
</section>
{% elif s.tipo == 'grid_produtos' %}
<section class="container" id="{{ s.id|e }}">
  <div class="products" id="product-grid">
    {% for p in s.produtos or [] %}
    <article class="product" data-cat="{{ ((p.categorias or [])|join(',') or (p.categoria or ''))|e }}">
      {% if p.badge %}<span class="badge-pos">{{ p.badge|e }}</span>{% endif %}
      {% if p.imagem %}<img src="{{ p.imagem|e }}" alt="{{ (p.nome or p.titulo)|e }}" height="260" style="object-fit:cover;width:100%">{% endif %}
      <div class="meta">
        <small style="opacity:.6">{{ (p.marca or p.categoria or p.tipo or '')|e }}</small>
        <h3 style="font-size:1rem;margin:4px 0">{{ (p.nome or p.titulo)|e }}</h3>
        <p class="price">R$ {{ p.preco }}
        {% if p.preco_original %}<s style="opacity:.5;font-size:.85rem">R$ {{ p.preco_original }}</s>{% endif %}
        </p>
        <button type="button" class="btn add-cart" data-name="{{ (p.nome or p.titulo)|e }}" data-price="{{ p.preco }}">Adicionar</button>
      </div>
    </article>
    {% endfor %}
  </div>
</section>
{% elif s.tipo == 'banner_promocional' %}
<section class="banner-sale" id="{{ s.id|e }}">
  <div class="container">
    <span style="color:var(--lime);font-size:.75rem">{{ s.tag|e }}</span>
    <h2 style="font-family:var(--fd);font-size:2rem;margin:8px 0">{{ s.titulo|e }}</h2>
    <p style="max-width:560px;margin:auto;color:var(--muted)">{{ s.subtitulo|e }}</p>
    {% if s.countdown %}<p id="cd" style="margin-top:16px;font-size:1.2rem;font-weight:700"></p>{% endif %}
    {% if s.imagem %}<img src="{{ s.imagem|e }}" alt="" style="margin-top:20px;max-height:280px;object-fit:cover;width:100%;border-radius:12px">{% endif %}
  </div>
</section>
{% elif s.tipo == 'brand_strip' %}
<section class="container brands" id="{{ s.id|e }}">
  {% for m in s.marcas or [] %}<span>{{ m.label|e if m is mapping else m|e }}</span>{% endfor %}
</section>
{% elif s.tipo == 'editorial_grid' %}
<section class="container editorial" id="{{ s.id|e }}">
  {% if s.principal %}
  <div style="position:relative">
    {% if s.principal.imagem %}<img src="{{ s.principal.imagem|e }}" alt="" style="width:100%;max-height:420px;object-fit:cover">{% endif %}
    <div style="position:absolute;bottom:16px;left:16px">
      <h3>{{ s.principal.titulo|e }}</h3>
      <p style="font-size:.85rem;opacity:.8">{{ s.principal.subtitulo|e }}</p>
    </div>
  </div>
  {% endif %}
  <div style="display:flex;flex-direction:column;gap:12px">
    {% for x in s.secundarios or [] %}
    <div>
      {% if x.imagem %}<img src="{{ x.imagem|e }}" alt="" height="180" style="object-fit:cover;width:100%">{% endif %}
      <strong>{{ x.titulo|e }}</strong>
      <p style="font-size:.8rem;opacity:.7">{{ x.sub|e }}</p>
    </div>
    {% endfor %}
  </div>
</section>
{% elif s.tipo == 'features_strip' %}
<section class="container features-strip" id="{{ s.id|e }}">
  {% for it in s.get('items', []) %}
  <div>
    <div style="font-size:1.2rem">{{ it.icone|e }}</div>
    <strong>{{ it.titulo|e }}</strong>
    <p style="font-size:.85rem;color:var(--muted);margin-top:4px">{{ it.descricao|e }}</p>
  </div>
  {% endfor %}
</section>
{% elif s.tipo == 'footer' %}
<footer id="{{ s.id|e }}">
  <div class="container">
    <div class="logo" style="margin-bottom:8px">{% if s.logo is mapping %}{{ (s.logo.label or s.logo.url or s.logo.nome or 'Logo')|e }}{% else %}{{ (s.logo|replace('.png','')|replace('.jpg',''))|e }}{% endif %}</div>
    <p style="color:var(--muted);max-width:480px;margin-bottom:20px">{{ s.descricao|e }}</p>
    <div class="footer-grid">
      {% for col in s.colunas or [] %}
      <div>
        <strong>{{ col.titulo|e }}</strong>
        {% for lk in col.links or [] %}<div style="margin-top:6px"><a href="{% if lk is mapping %}{{ (lk.href or lk.url or '#')|e }}{% else %}#{% endif %}">{% if lk is string %}{{ lk|e }}{% else %}{{ (lk.label or lk.texto or '')|e }}{% endif %}</a></div>{% endfor %}
      </div>
      {% endfor %}
    </div>
    <p style="margin-top:24px;text-align:center;font-size:.75rem">{{ s.copyright|e }}</p>
  </div>
</footer>
{% endif %}
{% endfor %}
</main>
<div id="ov" class="overlay" onclick="document.getElementById('cart').classList.remove('open');this.classList.remove('show')"></div>
<aside id="cart" class="drawer">
  <h3 style="margin-bottom:16px">Carrinho</h3>
  <div id="cart-lines"></div>
  <p style="margin-top:12px">Total: R$ <span id="cart-total">0</span></p>
  <button type="button" class="btn" onclick="alert('Checkout simulado')">Finalizar</button>
</aside>
<script>
(function(){
  var count=0,total=0;
  document.querySelectorAll('.add-cart').forEach(function(btn){
    btn.addEventListener('click',function(){
      var p=parseFloat(btn.getAttribute('data-price'))||0;
      total+=p;count++;
      document.getElementById('cc').textContent=count;
      document.getElementById('cart-total').textContent=total.toFixed(2);
      var line=document.createElement('div');line.style.cssText='padding:8px 0;border-bottom:1px solid #333;font-size:.85rem';
      line.textContent=btn.getAttribute('data-name')+' â€” R$ '+p;
      document.getElementById('cart-lines').appendChild(line);
      document.getElementById('cart').classList.add('open');
      document.getElementById('ov').classList.add('show');
    });
  });
  document.querySelectorAll('#filters .chip').forEach(function(ch){
    ch.addEventListener('click',function(){
      var f=ch.getAttribute('data-f');
      document.querySelectorAll('#filters .chip').forEach(function(x){x.classList.remove('active');});
      ch.classList.add('active');
      document.querySelectorAll('.product').forEach(function(p){
        var cats=(p.getAttribute('data-cat')||'');
        p.style.display=(f==='Todos'||!f||cats.indexOf(f)>=0)?'block':'none';
      });
    });
  });
  var end=Date.now()+8*3600*1000;
  function tick(){
    var el=document.getElementById('cd');if(!el)return;
    var ms=Math.max(0,end-Date.now());
    var h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000);
    el.textContent=h+'h '+m+'m '+s+'s';
    requestAnimationFrame(tick);
  }
  tick();
})();
</script>
</body>
</html>"""
)


def _normalize_ecommerce_secoes(secoes: list[Any]) -> None:
    """Assure que chaque section a 'tipo' (alias FR/PT) et que boutons/liens ne sont pas des chaÃ®nes repr."""
    for sec in secoes:
        if not isinstance(sec, dict):
            continue
        if not sec.get("tipo") and sec.get("type"):
            sec["tipo"] = sec["type"]
        for key in ("botoes", "boutons", "stats"):
            if isinstance(sec.get(key), list):
                coerce_mapping_list(sec[key])
        if sec.get("tipo") == "navegacao":
            if isinstance(sec.get("categorias"), list):
                coerce_mapping_list(sec["categorias"])


def render_ecommerce(site: dict[str, Any]) -> str:
    design = site.get("design") or {}
    # Palette figée : fond / surfaces inchangés par la sortie IA (accents inchangés aussi).
    paleta = dict(_DEFAULT_PAL)
    tip = design.get("tipografia") or {}
    fd = font_query_name(tip.get("display"))
    fc = font_query_name(tip.get("corpo"))
    fonts_url = google_fonts_link(tip.get("display"), tip.get("corpo"))
    secoes = site.get("secoes") or []
    _normalize_ecommerce_secoes(secoes)
    ticker = list(_CANONICAL_TICKER_MESSAGES)
    nav_sec = next((s for s in secoes if s.get("tipo") == "navegacao"), None)
    nav_cats = (nav_sec.get("categorias") or []) if nav_sec else []
    nome = site.get("nome") or "Loja"
    lang = site.get("idioma") or "pt-BR"
    return _TEMPLATE.render(
        lang=lang,
        title=nome,
        nome=nome,
        fonts_url=fonts_url,
        paleta=paleta,
        fd=fd,
        fc=fc,
        ticker=ticker,
        nav_cats=nav_cats,
        secoes=secoes,
    )
