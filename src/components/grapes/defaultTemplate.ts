export const DEFAULT_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="description" content="Laurena - Crie seus templates sem programar"/>
  <title>Laurena - Construtor web sem codigo</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="styles.css"/>
</head>
<body>

  <header role="banner" class="header-banner">
    <div class="container-width">

      <nav role="navigation" aria-label="Navegacao principal" class="navbar">
        <div class="logo">
          <h1>Laurena</h1>
        </div>
        <ul class="menu">
          <li><a href="#builder" class="menu-item">Builder</a></li>
          <li><a href="#template" class="menu-item">Template</a></li>
          <li><a href="#web" class="menu-item">Web</a></li>
        </ul>
      </nav>

      <section aria-labelledby="hero-title" class="hero">
        <h2 id="hero-title" class="hero-title">
          Crie seus templates<br><em>sem programar</em>
        </h2>
        <p class="hero-subtitle">
          Todos os blocos de texto podem ser editados com duplo clique.
          Voce pode criar novos blocos de texto pelo painel esquerdo.
        </p>
        <button type="button" aria-label="Passe o mouse para mais informacoes" class="hero-btn">
          Passe o mouse
        </button>
      </section>

      <div class="hero-notice" id="i2mek">
        Insira aqui seu conteudo de texto
      </div>

    </div>
  </header>

  <button type="button" aria-label="Enviar formulario" class="cta-btn">Enviar</button>

  <section aria-labelledby="flex-title" class="flex-section">
    <div class="container-width">
      <h2 id="flex-title" class="section-title">Flex e o novo padrao</h2>
      <p class="section-description">
        Com flexbox voce cria layouts complexos com facilidade e responsividade total.
      </p>
      <div role="list" class="cards-grid">

        <article role="listitem" class="card">
          <div class="card-header card-header-1"></div>
          <div class="card-body">
            <p class="card-subtitle">Categoria um</p>
            <h3 class="card-title">Titulo um</h3>
            <p class="card-description">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore.</p>
          </div>
        </article>

        <article role="listitem" class="card">
          <div class="card-header card-header-2"></div>
          <div class="card-body">
            <p class="card-subtitle">Categoria dois</p>
            <h3 class="card-title">Titulo dois</h3>
            <p class="card-description">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore.</p>
          </div>
        </article>

        <article role="listitem" class="card">
          <div class="card-header card-header-3"></div>
          <div class="card-body">
            <p class="card-subtitle">Categoria tres</p>
            <h3 class="card-title">Titulo tres</h3>
            <p class="card-description">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore.</p>
          </div>
        </article>

      </div>
    </div>
  </section>

  <section aria-labelledby="asset-title" class="asset-section">
    <div class="container-width">
      <div class="asset-container">
        <img src="/assets/images/demos/phone-app.png" alt="Demonstracao de app mobile" class="asset-image"/>
        <div class="asset-content">
          <span class="asset-label">Gerenciador de Assets</span>
          <h2 id="asset-title" class="asset-title">
            Gerencie suas imagens com o gerenciador de assets
          </h2>
          <p class="asset-description">
            Voce pode criar blocos de imagem pelo painel esquerdo e editar com duplo clique.
          </p>
          <p class="asset-note">Upload de imagens nao esta disponivel nesta demo</p>
        </div>
      </div>
    </div>
  </section>

  <section aria-labelledby="blocks-title" class="blocks-section">
    <div class="container-width">
      <h2 id="blocks-title" class="section-title">Blocos</h2>
      <p class="section-description">
        Cada elemento da pagina HTML pode ser um bloco. No painel esquerdo voce cria, move e estiliza blocos.
      </p>
      <div role="list" class="pricing-grid">

        <div role="listitem" class="pricing-card starter-plan">
          <h3 class="pricing-title">Starter</h3>
          <p class="pricing-description">Lista de exemplo</p>
          <ul class="pricing-features">
            <li class="feature">Starter feature 1</li>
            <li class="feature">Starter feature 2</li>
            <li class="feature">Starter feature 3</li>
            <li class="feature">Starter feature 4</li>
          </ul>
          <p class="pricing-amount">$9,90<span>/mes</span></p>
          <button type="button" class="pricing-btn">Escolher plano</button>
        </div>

        <div role="listitem" class="pricing-card regular-plan featured">
          <span class="badge-featured">Popular</span>
          <h3 class="pricing-title">Regular</h3>
          <p class="pricing-description">Lista de exemplo</p>
          <ul class="pricing-features">
            <li class="feature">Regular feature 1</li>
            <li class="feature">Regular feature 2</li>
            <li class="feature">Regular feature 3</li>
            <li class="feature">Regular feature 4</li>
          </ul>
          <p class="pricing-amount">$19,90<span>/mes</span></p>
          <button type="button" class="pricing-btn primary">Escolher plano</button>
        </div>

        <div role="listitem" class="pricing-card enterprise-plan">
          <h3 class="pricing-title">Enterprise</h3>
          <p class="pricing-description">Lista de exemplo</p>
          <ul class="pricing-features">
            <li class="feature">Enterprise feature 1</li>
            <li class="feature">Enterprise feature 2</li>
            <li class="feature">Enterprise feature 3</li>
            <li class="feature">Enterprise feature 4</li>
          </ul>
          <p class="pricing-amount">$29,90<span>/mes</span></p>
          <button type="button" class="pricing-btn">Escolher plano</button>
        </div>

      </div>
    </div>
  </section>

  <footer role="contentinfo" class="footer">
    <div class="container-width">
      <div class="footer-content">

        <nav class="footer-nav">
          <div class="footer-section">
            <h3 class="footer-title">Sobre nos</h3>
            <ul class="footer-list">
              <li><a href="#contact">Contato</a></li>
              <li><a href="#events">Eventos</a></li>
              <li><a href="#company">Empresa</a></li>
              <li><a href="#jobs">Vagas</a></li>
              <li><a href="#blog">Blog</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h3 class="footer-title">Servicos</h3>
            <ul class="footer-list">
              <li><a href="#education">Educacao</a></li>
              <li><a href="#partner">Parceiros</a></li>
              <li><a href="#community">Comunidade</a></li>
              <li><a href="#forum">Forum</a></li>
              <li><a href="#download">Download</a></li>
              <li><a href="#upgrade">Upgrade</a></li>
            </ul>
          </div>
        </nav>

        <div class="footer-form">
          <h3 class="footer-title">Inscreva-se</h3>
          <p class="footer-form-desc">
            Assine nossa newsletter para receber ofertas exclusivas e as ultimas novidades.
          </p>
          <form method="POST" aria-label="Assinatura da newsletter" class="subscription-form">
            <input type="text" name="name" placeholder="Nome" required aria-label="Seu nome" class="form-input"/>
            <input type="email" name="email" placeholder="E-mail" required aria-label="Seu e-mail" class="form-input"/>
            <button type="submit" class="form-btn">Enviar</button>
          </form>
        </div>

      </div>
    </div>

    <div class="footer-copyright">
      <div class="container-width">
        <p class="copyright-text">feito com <strong>Laurena</strong></p>
        <div class="social-links">
          <a href="#facebook" aria-label="Facebook">Facebook</a>
          <a href="#twitter" aria-label="Twitter">Twitter</a>
          <a href="#linkedin" aria-label="LinkedIn">LinkedIn</a>
          <a href="#email" aria-label="Email">Email</a>
        </div>
      </div>
    </div>
  </footer>

</body>
</html>`;

export const DEFAULT_TEMPLATE_CSS = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --ink: #0d0d0d;
  --paper: #f5f0e8;
  --cream: #faf7f2;
  --gold: #c9a96e;
  --gold-light: #e8d5b0;
  --gold-dark: #8a6a38;
  --muted: #6b6460;
  --border: rgba(201, 169, 110, 0.25);
  --border-strong: rgba(201, 169, 110, 0.55);
  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-body: 'DM Sans', 'Segoe UI', sans-serif;
}

html { scroll-behavior: smooth; }

body {
  font-family: var(--font-body);
  font-weight: 300;
  line-height: 1.7;
  color: var(--ink);
  background: var(--cream);
  overflow-x: hidden;
}

.container-width {
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 2.5rem;
}

.header-banner {
  position: relative;
  background: var(--ink);
  color: var(--cream);
  padding: 0;
  overflow: hidden;
  border-radius: 0;
}

.header-banner::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
  opacity: 0.4;
  pointer-events: none;
  z-index: 1;
}

.header-banner::after {
  content: '';
  position: absolute;
  top: -10%;
  right: -5%;
  width: 55%;
  height: 130%;
  background: linear-gradient(135deg, rgba(201,169,110,0.07) 0%, rgba(201,169,110,0.02) 60%, transparent 100%);
  transform: skewX(-8deg);
  pointer-events: none;
  z-index: 1;
}

.header-banner .container-width {
  position: relative;
  z-index: 2;
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2.5rem 0 4rem;
  border-bottom: 1px solid rgba(201,169,110,0.18);
}

.logo h1 {
  font-family: var(--font-display);
  font-weight: 300;
  font-size: 1.9rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--cream);
}

.menu {
  display: flex;
  list-style: none;
  gap: 3rem;
}

.menu-item {
  color: rgba(245,240,232,0.6);
  font-weight: 400;
  font-size: 0.75rem;
  text-decoration: none;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  transition: color 0.3s ease;
  position: relative;
}

.menu-item::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 1px;
  background: var(--gold);
  transition: width 0.3s ease;
}

.menu-item:hover { color: var(--gold-light); }
.menu-item:hover::after { width: 100%; }

.hero {
  padding: 7rem 0 5rem;
  max-width: 760px;
}

.hero-title {
  font-family: var(--font-display);
  font-weight: 300;
  font-size: clamp(3rem, 6vw, 5.5rem);
  line-height: 1.08;
  letter-spacing: -0.01em;
  color: var(--cream);
  margin-bottom: 2rem;
}

.hero-title em {
  font-style: italic;
  color: var(--gold-light);
}

.hero-subtitle {
  font-size: 0.95rem;
  color: rgba(245,240,232,0.55);
  max-width: 480px;
  margin-bottom: 3rem;
  line-height: 1.8;
}

.hero-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2.25rem;
  background: transparent;
  border: 1px solid var(--gold);
  color: var(--gold-light);
  font-family: var(--font-body);
  font-size: 0.78rem;
  font-weight: 400;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  border-radius: 0;
  cursor: pointer;
  transition: background 0.3s, color 0.3s;
}

.hero-btn::after {
  content: '->';
  font-size: 1rem;
  transition: transform 0.3s;
}

.hero-btn:hover {
  background: var(--gold);
  color: var(--ink);
}

.hero-btn:hover::after {
  transform: translateX(4px);
}

.hero-notice {
  display: inline-block;
  margin-top: 3.5rem;
  margin-bottom: 3rem;
  padding: 0.8rem 1.5rem;
  background: rgba(201,169,110,0.08);
  border-left: 2px solid var(--gold);
  font-size: 0.82rem;
  color: rgba(245,240,232,0.5);
  letter-spacing: 0.05em;
}

.cta-btn {
  display: block;
  margin: 3rem auto;
  padding: 1.1rem 3rem;
  background: var(--ink);
  color: var(--gold-light);
  border: 1px solid var(--gold-dark);
  font-family: var(--font-body);
  font-size: 0.78rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.3s, color 0.3s, border-color 0.3s;
  border-radius: 0;
}

.cta-btn:hover {
  background: var(--gold);
  color: var(--ink);
  border-color: var(--gold);
}

section { padding: 6rem 0; }

.section-title {
  font-family: var(--font-display);
  font-weight: 300;
  font-size: clamp(2.2rem, 4vw, 3.5rem);
  letter-spacing: -0.01em;
  color: var(--ink);
  text-align: center;
  margin-bottom: 1rem;
  line-height: 1.15;
}

.section-description {
  text-align: center;
  color: var(--muted);
  font-size: 0.92rem;
  max-width: 560px;
  margin: 0 auto 3.5rem;
  line-height: 1.85;
}

.flex-section {
  background: var(--paper);
  position: relative;
}

.flex-section::before {
  content: 'LAURENA';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--font-display);
  font-size: 18vw;
  font-weight: 600;
  color: rgba(0,0,0,0.025);
  pointer-events: none;
  white-space: nowrap;
  letter-spacing: 0.1em;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5px;
  border: 1.5px solid var(--border-strong);
}

.card {
  background: var(--cream);
  border-radius: 0;
  overflow: hidden;
  border: none;
  box-shadow: none;
  transition: background 0.3s;
}

.card:hover { background: #fff; }

.card-header {
  height: 200px;
  position: relative;
  overflow: hidden;
}

.card-header-1 {
  background: linear-gradient(160deg, #1a1a1a 0%, #2e2e2e 50%, #c9a96e 100%);
}

.card-header-2 {
  background: linear-gradient(160deg, #2a1f14 0%, #6b4c2a 50%, #d4b07e 100%);
}

.card-header-3 {
  background: linear-gradient(160deg, #0d1a1a 0%, #1e3a3a 50%, #5a8a8a 100%);
}

.card-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border-strong);
}

.card-body {
  padding: 2rem;
  border-top: 1px solid var(--border);
}

.card-title {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 1.5rem;
  color: var(--ink);
  margin-bottom: 0.25rem;
  letter-spacing: 0.01em;
}

.card-subtitle {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--gold-dark);
  margin-bottom: 1rem;
}

.card-description {
  font-size: 0.88rem;
  color: var(--muted);
  line-height: 1.8;
}

.asset-section {
  background: var(--ink);
  color: var(--cream);
  position: relative;
  overflow: hidden;
}

.asset-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 60px,
    rgba(201,169,110,0.02) 60px,
    rgba(201,169,110,0.02) 61px
  );
}

.asset-container {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5rem;
  align-items: center;
}

.asset-image {
  width: 100%;
  border-radius: 0;
  filter: grayscale(15%) contrast(1.05);
  border: 1px solid rgba(201,169,110,0.2);
}

.asset-label {
  display: inline-block;
  margin-bottom: 1.5rem;
  padding: 0.4rem 1rem;
  background: transparent;
  border: 1px solid var(--gold);
  color: var(--gold);
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  border-radius: 0;
}

.asset-title {
  font-family: var(--font-display);
  font-weight: 300;
  font-size: clamp(2rem, 3.5vw, 3rem);
  line-height: 1.15;
  color: var(--cream);
  margin-bottom: 1.5rem;
}

.asset-description {
  font-size: 0.9rem;
  color: rgba(245,240,232,0.6);
  margin-bottom: 1rem;
  line-height: 1.85;
}

.asset-note {
  font-size: 0.78rem;
  color: rgba(245,240,232,0.3);
  letter-spacing: 0.05em;
  border-top: 1px solid rgba(201,169,110,0.15);
  padding-top: 1rem;
}

.blocks-section { background: var(--cream); }

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.pricing-card {
  background: var(--paper);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 2.5rem;
  position: relative;
  transition: border-color 0.3s, transform 0.3s;
}

.pricing-card:hover {
  border-color: var(--gold);
  transform: translateY(-4px);
}

.pricing-card.featured {
  background: var(--ink);
  color: var(--cream);
  border-color: var(--gold);
}

.badge-featured {
  position: absolute;
  top: -1px;
  right: 2rem;
  background: var(--gold);
  color: var(--ink);
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 0.35rem 0.85rem;
}

.pricing-title {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 1.8rem;
  margin-bottom: 0.25rem;
  letter-spacing: 0.02em;
}

.pricing-card.featured .pricing-title { color: var(--cream); }

.pricing-description {
  font-size: 0.8rem;
  color: var(--muted);
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
}

.pricing-card.featured .pricing-description { color: rgba(245,240,232,0.45); }

.pricing-features {
  list-style: none;
  margin: 1.5rem 0 2rem;
  border-top: 1px solid var(--border);
  padding-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.pricing-card.featured .pricing-features { border-color: rgba(201,169,110,0.25); }

.feature {
  font-size: 0.85rem;
  color: var(--muted);
  padding-left: 1rem;
  position: relative;
}

.feature::before {
  content: '-';
  position: absolute;
  left: 0;
  color: var(--gold);
  font-size: 0.7rem;
}

.pricing-card.featured .feature { color: rgba(245,240,232,0.65); }

.pricing-amount {
  font-family: var(--font-display);
  font-size: 2.8rem;
  font-weight: 300;
  color: var(--ink);
  margin-bottom: 1.75rem;
  line-height: 1;
}

.pricing-amount span {
  font-size: 0.9rem;
  font-family: var(--font-body);
  color: var(--muted);
  font-weight: 300;
}

.pricing-card.featured .pricing-amount { color: var(--gold-light); }

.pricing-btn {
  width: 100%;
  padding: 1rem;
  background: transparent;
  border: 1px solid var(--border-strong);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 0;
  transition: background 0.3s, color 0.3s, border-color 0.3s;
}

.pricing-btn:hover {
  background: var(--ink);
  color: var(--cream);
  border-color: var(--ink);
}

.pricing-btn.primary {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--ink);
}

.pricing-btn.primary:hover {
  background: var(--gold-dark);
  border-color: var(--gold-dark);
  color: var(--cream);
}

.footer {
  background: #080808;
  color: rgba(245,240,232,0.7);
}

.footer-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 4rem;
  padding: 5rem 0 4rem;
  border-bottom: 1px solid rgba(201,169,110,0.12);
}

.footer-nav {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
}

.footer-title {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 1.15rem;
  color: var(--cream);
  margin-bottom: 1.25rem;
  letter-spacing: 0.04em;
}

.footer-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.footer-list a {
  color: rgba(245,240,232,0.4);
  text-decoration: none;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  transition: color 0.3s;
}

.footer-list a:hover { color: var(--gold-light); }

.footer-form {
  background: rgba(201,169,110,0.05);
  border: 1px solid rgba(201,169,110,0.15);
  padding: 2rem;
  border-radius: 0;
}

.footer-form-desc {
  font-size: 0.82rem;
  color: rgba(245,240,232,0.4);
  margin-bottom: 1.5rem;
  line-height: 1.75;
}

.subscription-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-input {
  padding: 0.8rem 1rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(201,169,110,0.2);
  color: var(--cream);
  font-family: var(--font-body);
  font-size: 0.85rem;
  border-radius: 0;
  outline: none;
  transition: border-color 0.3s;
}

.form-input:focus { border-color: var(--gold); }
.form-input::placeholder { color: rgba(245,240,232,0.3); }

.form-btn {
  padding: 0.9rem;
  background: var(--gold);
  color: var(--ink);
  border: none;
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 0;
  transition: background 0.3s;
}

.form-btn:hover { background: var(--gold-dark); color: var(--cream); }

.footer-copyright {
  padding: 1.75rem 0;
}

.footer-copyright .container-width {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.copyright-text {
  font-size: 0.78rem;
  color: rgba(245,240,232,0.25);
  letter-spacing: 0.08em;
}

.copyright-text strong {
  color: var(--gold);
  font-weight: 400;
  font-family: var(--font-display);
  font-size: 0.9rem;
}

.social-links {
  display: flex;
  gap: 2rem;
}

.social-links a {
  color: rgba(245,240,232,0.3);
  text-decoration: none;
  font-size: 0.72rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  transition: color 0.3s;
}

.social-links a:hover { color: var(--gold); }

@media (max-width: 900px) {
  .asset-container { grid-template-columns: 1fr; gap: 2.5rem; }
  .footer-content { grid-template-columns: 1fr; gap: 2.5rem; }
  .footer-nav { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 768px) {
  .navbar { flex-direction: column; gap: 1.5rem; padding-bottom: 2.5rem; }
  .menu { gap: 1.5rem; }
  .hero { padding: 4rem 0 3rem; }
  .footer-nav { grid-template-columns: 1fr; }
  .footer-copyright .container-width { flex-direction: column; gap: 1rem; text-align: center; }
  .cards-grid { gap: 0; border: none; display: flex; flex-direction: column; }
  .card { border: 1px solid var(--border); margin-bottom: 1rem; }
}
`;

type TemplateLocale = 'en' | 'es' | 'fr' | 'pt';

type TemplateLocaleTexts = {
  metaDescription: string;
  documentTitle: string;
  heroTitle: string;
};

const TEMPLATE_LOCALE_TEXTS: Record<TemplateLocale, TemplateLocaleTexts> = {
  pt: {
    metaDescription: 'Laurena - Crie seus templates sem programar',
    documentTitle: 'Laurena - Construtor web sem codigo',
    heroTitle: 'Crie seus templates<br><em>sem programar</em>',
  },
  en: {
    metaDescription: 'Laurena - Create your templates without coding',
    documentTitle: 'Laurena - No-code website builder',
    heroTitle: 'Create your templates<br><em>without coding</em>',
  },
  es: {
    metaDescription: 'Laurena - Crea tus templates sin programar',
    documentTitle: 'Laurena - Constructor web sin codigo',
    heroTitle: 'Crea tus templates<br><em>sin programar</em>',
  },
  fr: {
    metaDescription: 'Laurena - Creez vos templates sans coder',
    documentTitle: 'Laurena - Constructeur web sans code',
    heroTitle: 'Creez vos templates<br><em>sans coder</em>',
  },
};

function normalizeTemplateLocale(locale?: string): TemplateLocale {
  const lower = String(locale ?? '').toLowerCase();
  if (lower.startsWith('fr')) return 'fr';
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('pt')) return 'pt';
  return 'en';
}

export function getDefaultTemplateHtml(locale?: string): string {
  const normalized = normalizeTemplateLocale(locale);
  const htmlLang = normalized === 'pt' ? 'pt-BR' : normalized;
  const texts = TEMPLATE_LOCALE_TEXTS[normalized] ?? TEMPLATE_LOCALE_TEXTS.en;
  return DEFAULT_TEMPLATE_HTML
    .replace('<html lang="pt-BR">', `<html lang="${htmlLang}">`)
    .replace('Laurena - Crie seus templates sem programar', texts.metaDescription)
    .replace('Laurena - Construtor web sem codigo', texts.documentTitle)
    .replace('Crie seus templates<br><em>sem programar</em>', texts.heroTitle);
}
