export const DEFAULT_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="GrapesJS - Construisez vos templates sans coder" />
  <title>GrapesJS - Web Builder sans code</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="header-banner" role="banner">
    <div class="container-width">
      <nav class="navbar" role="navigation" aria-label="Navigation principale">
        <div class="logo"><h1>GrapesJS</h1></div>
        <ul class="menu">
          <li><a href="#builder" class="menu-item">BUILDER</a></li>
          <li><a href="#template" class="menu-item">TEMPLATE</a></li>
          <li><a href="#web" class="menu-item">WEB</a></li>
        </ul>
      </nav>

      <section class="hero" aria-labelledby="hero-title">
        <h2 id="hero-title" class="hero-title">Build your templates without coding</h2>
        <p class="hero-subtitle">
          All text blocks could be edited easily with double clicking on it.
          You can create new text blocks with the command from the left panel
        </p>
        <button class="hero-btn" aria-label="Hover pour plus d'informations">Hover me</button>
      </section>

      <div class="hero-notice">Insert your text content here</div>
    </div>
  </header>

  <button type="button" class="cta-btn" aria-label="Envoyer le formulaire">Send</button>

  <section class="flex-section" aria-labelledby="flex-title">
    <div class="container-width">
      <h2 id="flex-title" class="section-title">Flex is the new black</h2>
      <p class="section-description">
        With flexbox system you're able to build complex layouts easily and with free responsivity
      </p>

      <div class="cards-grid" role="list">
        <article class="card" role="listitem">
          <div class="card-header card-header-1"></div>
          <div class="card-body">
            <h3 class="card-title">Title one</h3>
            <p class="card-subtitle">Subtitle one</p>
            <p class="card-description">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore</p>
          </div>
        </article>

        <article class="card" role="listitem">
          <div class="card-header card-header-2"></div>
          <div class="card-body">
            <h3 class="card-title">Title two</h3>
            <p class="card-subtitle">Subtitle two</p>
            <p class="card-description">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore</p>
          </div>
        </article>

        <article class="card" role="listitem">
          <div class="card-header card-header-3"></div>
          <div class="card-body">
            <h3 class="card-title">Title three</h3>
            <p class="card-subtitle">Subtitle three</p>
            <p class="card-description">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore</p>
          </div>
        </article>
      </div>
    </div>
  </section>

  <section class="asset-section" aria-labelledby="asset-title">
    <div class="container-width">
      <div class="asset-container">
        <img src="/assets/images/demos/phone-app.png" alt="Application mobile demonstration" class="asset-image" />
        <div class="asset-content">
          <span class="asset-label">ASSET MANAGER</span>
          <h2 id="asset-title" class="asset-title">Manage your images with Asset Manager</h2>
          <p class="asset-description">You can create image blocks with the command from the left panel and edit them with double click</p>
          <p class="asset-note">Image uploading is not allowed in this demo</p>
        </div>
      </div>
    </div>
  </section>

  <section class="blocks-section" aria-labelledby="blocks-title">
    <div class="container-width">
      <h2 id="blocks-title" class="section-title">Blocks</h2>
      <p class="section-description">Each element in HTML page could be seen as a block. On the left panel you could find different kind of blocks that you can create, move and style</p>

      <div class="pricing-grid" role="list">
        <div class="pricing-card starter-plan" role="listitem">
          <h3 class="pricing-title">Starter</h3>
          <p class="pricing-description">Some random list</p>
          <ul class="pricing-features">
            <li class="feature">+ Starter feature 1</li>
            <li class="feature">+ Starter feature 2</li>
            <li class="feature">+ Starter feature 3</li>
            <li class="feature">+ Starter feature 4</li>
          </ul>
          <p class="pricing-amount">$9,90<span>/month</span></p>
          <button class="pricing-btn">Choose Plan</button>
        </div>

        <div class="pricing-card regular-plan featured" role="listitem">
          <span class="badge-featured">Popular</span>
          <h3 class="pricing-title">Regular</h3>
          <p class="pricing-description">Some random list</p>
          <ul class="pricing-features">
            <li class="feature">+ Regular feature 1</li>
            <li class="feature">+ Regular feature 2</li>
            <li class="feature">+ Regular feature 3</li>
            <li class="feature">+ Regular feature 4</li>
          </ul>
          <p class="pricing-amount">$19,90<span>/month</span></p>
          <button class="pricing-btn primary">Choose Plan</button>
        </div>

        <div class="pricing-card enterprise-plan" role="listitem">
          <h3 class="pricing-title">Enterprise</h3>
          <p class="pricing-description">Some random list</p>
          <ul class="pricing-features">
            <li class="feature">+ Enterprise feature 1</li>
            <li class="feature">+ Enterprise feature 2</li>
            <li class="feature">+ Enterprise feature 3</li>
            <li class="feature">+ Enterprise feature 4</li>
          </ul>
          <p class="pricing-amount">$29,90<span>/month</span></p>
          <button class="pricing-btn">Choose Plan</button>
        </div>
      </div>
    </div>
  </section>

  <footer class="footer" role="contentinfo">
    <div class="container-width">
      <div class="footer-content">
        <nav class="footer-nav">
          <div class="footer-section">
            <h3 class="footer-title">About us</h3>
            <ul class="footer-list">
              <li><a href="#contact">Contact</a></li>
              <li><a href="#events">Events</a></li>
              <li><a href="#company">Company</a></li>
              <li><a href="#jobs">Jobs</a></li>
              <li><a href="#blog">Blog</a></li>
            </ul>
          </div>

          <div class="footer-section">
            <h3 class="footer-title">Services</h3>
            <ul class="footer-list">
              <li><a href="#education">Education</a></li>
              <li><a href="#partner">Partner</a></li>
              <li><a href="#community">Community</a></li>
              <li><a href="#forum">Forum</a></li>
              <li><a href="#download">Download</a></li>
              <li><a href="#upgrade">Upgrade</a></li>
            </ul>
          </div>
        </nav>

        <div class="footer-form">
          <h3 class="footer-title">Subscribe</h3>
          <p class="footer-form-desc">Subscribe to our newsletter to receive exclusive offers and the latest news</p>
          <form class="subscription-form" method="POST" aria-label="Newsletter subscription">
            <input type="text" name="name" placeholder="Name" class="form-input" required aria-label="Your name" />
            <input type="email" name="email" placeholder="Email" class="form-input" required aria-label="Your email" />
            <button type="submit" class="form-btn">Submit</button>
          </form>
        </div>
      </div>
    </div>

    <div class="footer-copyright">
      <div class="container-width">
        <p class="copyright-text">made with <strong>GrapesJS</strong></p>
        <div class="social-links">
          <a href="#facebook" aria-label="Facebook">facebook</a>
          <a href="#twitter" aria-label="Twitter">twitter</a>
          <a href="#linkedin" aria-label="LinkedIn">linkedin</a>
          <a href="#email" aria-label="Email">mail</a>
        </div>
      </div>
    </div>
  </footer>
</body>
</html>`;

export const DEFAULT_TEMPLATE_CSS = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: #374151;
  background-color: #ffffff;
}

:root {
  --color-primary: #3b82f6;
  --color-primary-light: #dbeafe;
  --color-primary-dark: #1e40af;
  --color-secondary: #8b5cf6;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-300: #d1d5db;
  --color-gray-400: #9ca3af;
  --color-gray-500: #6b7280;
  --color-gray-600: #4b5563;
  --color-gray-700: #374151;
  --color-gray-800: #1f2937;
  --color-gray-900: #111827;
}

.container-width {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

section {
  padding: 4rem 0;
}

.header-banner {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  color: #fff;
  padding: 4rem 0;
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;
}

.menu {
  display: flex;
  list-style: none;
  gap: 2rem;
}

.menu-item {
  color: #fff;
  font-weight: 600;
  text-decoration: none;
}

.hero {
  text-align: center;
}

.hero-title {
  color: #fff;
  font-size: 2.25rem;
  margin-bottom: 1rem;
}

.hero-subtitle {
  max-width: 640px;
  margin: 0 auto 1.5rem;
}

.hero-btn,
.cta-btn,
.pricing-btn,
.form-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 600;
}

.hero-btn {
  background: #fff;
  color: var(--color-primary);
}

.hero-notice {
  margin-top: 1.5rem;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 0.5rem;
  padding: 1rem;
  text-align: center;
}

.cta-btn {
  display: block;
  margin: 1.25rem auto;
  background: var(--color-primary);
  color: #fff;
}

.flex-section {
  background: var(--color-gray-50);
}

.section-title {
  text-align: center;
  color: var(--color-gray-900);
  margin-bottom: 0.75rem;
}

.section-description {
  text-align: center;
  color: var(--color-gray-600);
  max-width: 680px;
  margin: 0 auto 2rem;
}

.cards-grid,
.pricing-grid,
.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.card,
.pricing-card,
.team-member {
  background: #fff;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

.card-header {
  height: 150px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
}

.card-body,
.pricing-card,
.team-body,
.footer-form {
  padding: 1.5rem;
}

.asset-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: center;
}

.asset-image {
  width: 100%;
  border-radius: 0.75rem;
}

.asset-label {
  display: inline-block;
  margin-bottom: 1rem;
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 700;
}

.pricing-features {
  list-style: none;
  margin: 1rem 0;
}

.feature {
  margin: 0.4rem 0;
}

.pricing-btn {
  background: #fff;
  border: 2px solid var(--color-primary);
  color: var(--color-primary);
}

.pricing-btn.primary {
  background: var(--color-primary);
  color: #fff;
}

.team-header {
  height: 110px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
}

.team-avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  margin: -48px auto 0;
  display: block;
  border: 3px solid #fff;
}

.team-social {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
}

.social-link {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid var(--color-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  text-decoration: none;
}

.footer {
  background: var(--color-gray-900);
  color: #fff;
}

.footer-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
  padding: 3rem 0;
}

.footer-nav {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

.footer-list {
  list-style: none;
}

.footer-list a {
  color: var(--color-gray-300);
  text-decoration: none;
}

.footer-form {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 0.75rem;
}

.subscription-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-input {
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  padding: 0.65rem 0.85rem;
  border-radius: 0.5rem;
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.7);
}

.form-btn {
  background: var(--color-primary);
  color: #fff;
}

.footer-copyright {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding: 1rem 0;
}

.footer-copyright .container-width {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.social-links {
  display: flex;
  gap: 0.85rem;
}

.social-links a {
  color: var(--color-gray-300);
  text-decoration: none;
}

@media (max-width: 768px) {
  .navbar {
    flex-direction: column;
    gap: 1rem;
  }

  .menu {
    gap: 1rem;
  }

  .asset-container,
  .footer-content,
  .footer-nav {
    grid-template-columns: 1fr;
  }

  .footer-copyright .container-width {
    flex-direction: column;
    gap: 0.75rem;
  }
}
`;

type TemplateLocale = 'en' | 'es' | 'fr' | 'pt';

type TemplateDictionary = {
  htmlLang: string;
  replacements: Array<[from: string, to: string]>;
};

const templateDictionary: Record<TemplateLocale, TemplateDictionary> = {
  en: {
    htmlLang: 'en',
    replacements: [
      ['Construisez vos templates sans coder', 'Build your templates without coding'],
      ['Web Builder sans code', 'No-code Web Builder'],
      ['Navigation principale', 'Main navigation'],
      ['Hover pour plus d\'informations', 'Hover for more information'],
      ['Insert your text content here', 'Insert your text content here'],
      ['Envoyer le formulaire', 'Send form'],
      ['Application mobile demonstration', 'Mobile app demo'],
      ['Manage your images with Asset Manager', 'Manage your images with Asset Manager'],
      ['Image uploading is not allowed in this demo', 'Image uploading is not allowed in this demo'],
      ['About us', 'About us'],
      ['Services', 'Services'],
      ['Subscribe', 'Subscribe'],
      ['Subscribe to our newsletter to receive exclusive offers and the latest news', 'Subscribe to our newsletter to receive exclusive offers and the latest news'],
      ['Newsletter subscription', 'Newsletter subscription'],
      ['Votre nom', 'Your name'],
      ['made with <strong>GrapesJS</strong>', 'Made with <strong>GrapesJS</strong>'],
      ['mail', 'email'],
    ],
  },
  es: {
    htmlLang: 'es',
    replacements: [
      ['Construisez vos templates sans coder', 'Crea tus plantillas sin programar'],
      ['Web Builder sans code', 'Constructor web sin codigo'],
      ['Navigation principale', 'Navegacion principal'],
      ['Build your templates without coding', 'Crea tus plantillas sin programar'],
      ['All text blocks could be edited easily with double clicking on it.', 'Todos los bloques de texto se pueden editar facilmente con doble clic.'],
      ['You can create new text blocks with the command from the left panel', 'Puedes crear nuevos bloques de texto desde el panel izquierdo.'],
      ['Hover pour plus d\'informations', 'Pasa el cursor para mas informacion'],
      ['Hover me', 'Pasa el cursor'],
      ['Insert your text content here', 'Inserta aqui tu contenido de texto'],
      ['Send', 'Enviar'],
      ['Flex is the new black', 'Flex es la nueva referencia'],
      ['With flexbox system you\'re able to build complex layouts easily and with free responsivity', 'Con flexbox puedes crear disenos complejos de forma sencilla y responsive.'],
      ['Title one', 'Titulo uno'],
      ['Subtitle one', 'Subtitulo uno'],
      ['Title two', 'Titulo dos'],
      ['Subtitle two', 'Subtitulo dos'],
      ['Title three', 'Titulo tres'],
      ['Subtitle three', 'Subtitulo tres'],
      ['ASSET MANAGER', 'GESTOR DE RECURSOS'],
      ['Manage your images with Asset Manager', 'Gestiona tus imagenes con el gestor de recursos'],
      ['You can create image blocks with the command from the left panel and edit them with double click', 'Puedes crear bloques de imagen desde el panel izquierdo y editarlos con doble clic.'],
      ['Image uploading is not allowed in this demo', 'La carga de imagenes no esta disponible en esta demo'],
      ['Blocks', 'Bloques'],
      ['Each element in HTML page could be seen as a block. On the left panel you could find different kind of blocks that you can create, move and style', 'Cada elemento HTML puede verse como un bloque. En el panel izquierdo puedes crear, mover y estilizar bloques.'],
      ['Some random list', 'Lista de ejemplo'],
      ['Choose Plan', 'Elegir plan'],
      ['Popular', 'Popular'],
      ['About us', 'Sobre nosotros'],
      ['Contact', 'Contacto'],
      ['Events', 'Eventos'],
      ['Company', 'Empresa'],
      ['Jobs', 'Empleos'],
      ['Services', 'Servicios'],
      ['Education', 'Educacion'],
      ['Partner', 'Socios'],
      ['Community', 'Comunidad'],
      ['Forum', 'Foro'],
      ['Download', 'Descargar'],
      ['Upgrade', 'Mejorar'],
      ['Subscribe', 'Suscribete'],
      ['Subscribe to our newsletter to receive exclusive offers and the latest news', 'Suscribete al boletin para recibir ofertas exclusivas y novedades.'],
      ['Newsletter subscription', 'Suscripcion al boletin'],
      ['Name', 'Nombre'],
      ['Your name', 'Tu nombre'],
      ['Your email', 'Tu correo'],
      ['Submit', 'Enviar'],
      ['made with <strong>GrapesJS</strong>', 'Hecho con <strong>GrapesJS</strong>'],
      ['facebook', 'facebook'],
      ['twitter', 'twitter'],
      ['linkedin', 'linkedin'],
      ['mail', 'correo'],
    ],
  },
  fr: {
    htmlLang: 'fr',
    replacements: [
      ['Construisez vos templates sans coder', 'Construisez vos templates sans coder'],
      ['Web Builder sans code', 'Web Builder sans code'],
      ['Build your templates without coding', 'Construisez vos templates sans coder'],
      ['All text blocks could be edited easily with double clicking on it.', 'Tous les blocs de texte sont modifiables facilement avec un double-clic.'],
      ['You can create new text blocks with the command from the left panel', 'Vous pouvez creer de nouveaux blocs de texte depuis le panneau de gauche.'],
      ['Hover me', 'Survolez-moi'],
      ['Insert your text content here', 'Inserez votre contenu texte ici'],
      ['Send', 'Envoyer'],
      ['Flex is the new black', 'Flex est la nouvelle reference'],
      ['With flexbox system you\'re able to build complex layouts easily and with free responsivity', 'Avec flexbox, vous pouvez creer facilement des mises en page complexes et responsives.'],
      ['Title one', 'Titre un'],
      ['Subtitle one', 'Sous-titre un'],
      ['Title two', 'Titre deux'],
      ['Subtitle two', 'Sous-titre deux'],
      ['Title three', 'Titre trois'],
      ['Subtitle three', 'Sous-titre trois'],
      ['ASSET MANAGER', 'GESTIONNAIRE DE RESSOURCES'],
      ['Manage your images with Asset Manager', 'Gerez vos images avec le gestionnaire de ressources'],
      ['You can create image blocks with the command from the left panel and edit them with double click', 'Vous pouvez creer des blocs image depuis le panneau de gauche et les modifier en double-cliquant.'],
      ['Blocks', 'Blocs'],
      ['Some random list', 'Liste exemple'],
      ['Choose Plan', 'Choisir le plan'],
      ['About us', 'A propos'],
      ['Services', 'Services'],
      ['Subscribe', 'S\'abonner'],
      ['Name', 'Nom'],
      ['Submit', 'Envoyer'],
      ['made with <strong>GrapesJS</strong>', 'Cree avec <strong>GrapesJS</strong>'],
      ['mail', 'email'],
    ],
  },
  pt: {
    htmlLang: 'pt-BR',
    replacements: [
      ['Construisez vos templates sans coder', 'Crie seus templates sem programar'],
      ['Web Builder sans code', 'Construtor web sem codigo'],
      ['Navigation principale', 'Navegacao principal'],
      ['Build your templates without coding', 'Crie seus templates sem programar'],
      ['All text blocks could be edited easily with double clicking on it.', 'Todos os blocos de texto podem ser editados com duplo clique.'],
      ['You can create new text blocks with the command from the left panel', 'Voce pode criar novos blocos de texto pelo painel esquerdo.'],
      ['Hover pour plus d\'informations', 'Passe o mouse para mais informacoes'],
      ['Hover me', 'Passe o mouse'],
      ['Insert your text content here', 'Insira aqui seu conteudo de texto'],
      ['Envoyer le formulaire', 'Enviar formulario'],
      ['Send', 'Enviar'],
      ['Flex is the new black', 'Flex e o novo padrao'],
      ['With flexbox system you\'re able to build complex layouts easily and with free responsivity', 'Com flexbox voce cria layouts complexos com facilidade e responsividade.'],
      ['Title one', 'Titulo um'],
      ['Subtitle one', 'Subtitulo um'],
      ['Title two', 'Titulo dois'],
      ['Subtitle two', 'Subtitulo dois'],
      ['Title three', 'Titulo tres'],
      ['Subtitle three', 'Subtitulo tres'],
      ['Application mobile demonstration', 'Demonstracao de app mobile'],
      ['ASSET MANAGER', 'GERENCIADOR DE ASSETS'],
      ['Manage your images with Asset Manager', 'Gerencie suas imagens com o gerenciador de assets'],
      ['You can create image blocks with the command from the left panel and edit them with double click', 'Voce pode criar blocos de imagem pelo painel esquerdo e editar com duplo clique.'],
      ['Image uploading is not allowed in this demo', 'Upload de imagens nao esta disponivel nesta demo'],
      ['Blocks', 'Blocos'],
      ['Each element in HTML page could be seen as a block. On the left panel you could find different kind of blocks that you can create, move and style', 'Cada elemento da pagina HTML pode ser um bloco. No painel esquerdo voce cria, move e estiliza blocos.'],
      ['Some random list', 'Lista de exemplo'],
      ['Choose Plan', 'Escolher plano'],
      ['Popular', 'Popular'],
      ['About us', 'Sobre nos'],
      ['Contact', 'Contato'],
      ['Events', 'Eventos'],
      ['Company', 'Empresa'],
      ['Jobs', 'Vagas'],
      ['Services', 'Servicos'],
      ['Education', 'Educacao'],
      ['Partner', 'Parceiros'],
      ['Community', 'Comunidade'],
      ['Forum', 'Forum'],
      ['Download', 'Download'],
      ['Upgrade', 'Upgrade'],
      ['Subscribe', 'Inscreva-se'],
      ['Subscribe to our newsletter to receive exclusive offers and the latest news', 'Assine nossa newsletter para receber ofertas exclusivas e novidades.'],
      ['Newsletter subscription', 'Assinatura da newsletter'],
      ['Name', 'Nome'],
      ['Your name', 'Seu nome'],
      ['Your email', 'Seu e-mail'],
      ['Submit', 'Enviar'],
      ['made with <strong>GrapesJS</strong>', 'feito com <strong>GrapesJS</strong>'],
      ['mail', 'email'],
    ],
  },
};

function normalizeTemplateLocale(locale?: string): TemplateLocale {
  const lower = String(locale ?? '').toLowerCase();
  if (lower.startsWith('fr')) return 'fr';
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('pt')) return 'pt';
  return 'en';
}

function replaceAllExact(content: string, from: string, to: string): string {
  return content.split(from).join(to);
}

export function getDefaultTemplateHtml(locale?: string): string {
  const normalized = normalizeTemplateLocale(locale);
  const dictionary = templateDictionary[normalized];
  let html = DEFAULT_TEMPLATE_HTML;

  html = replaceAllExact(html, '<html lang="fr">', `<html lang="${dictionary.htmlLang}">`);
  for (const [from, to] of dictionary.replacements) {
    html = replaceAllExact(html, from, to);
  }

  return html;
}
