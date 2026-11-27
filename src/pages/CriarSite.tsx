import { Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Resolve the builder URL at RUNTIME from the current hostname.
 * This avoids baking a value at Docker build time (VITE_* vars are build-time only).
 *
 * laurenastudio.pro   → https://dev.laurenastudio.pro
 * localhost           → http://localhost:2020  (local dev)
 * any other hostname  → https://dev.<hostname>
 */
function getBuilderUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:2020';
  const { hostname, protocol } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:2020';
  }
  // Strip leading "www." if present, then prepend "dev."
  const base = hostname.replace(/^www\./, '');
  return `${protocol}//dev.${base}`;
}

/**
 * Kick off the internal OAuth2 flow via the builder's /auth/login page.
 *
 * Why not call FastAPI /oauth/authorize directly?
 * sessionStorage is origin-scoped. If we generate the CSRF state here
 * (laurenastudio.pro) and store it in sessionStorage, the callback page
 * on dev.laurenastudio.pro cannot read it — different origin, different storage.
 * Redirecting to /auth/login on the builder ensures the state is generated
 * and stored in the builder's own sessionStorage before FastAPI is called.
 */
function startBuilderOAuth() {
  window.location.href = `${getBuilderUrl()}/auth/login`;
}

// ─── Option static config (no display strings) ───────────────────────────────

type OptionConfig = {
  id: string;
  external: boolean;
  href?: string;
};

const OPTION_CONFIGS: OptionConfig[] = [
  {
    id: 'template',
    external: false,
    href: '/template',
  },
  {
    id: 'ai',
    external: true,
  },
];

// ─── Page component ───────────────────────────────────────────────────────────

const OPTION_LABELS: Record<string, { badge: string; title: string; description: string; cta: string; tag: string }> = {
  template: {
    badge:       'pages.criarSite.templateBadge',
    title:       'pages.criarSite.templateTitle',
    description: 'pages.criarSite.templateDesc',
    cta:         'pages.criarSite.templateCta',
    tag:         'pages.criarSite.templateTag',
  },
  ai: {
    badge:       'pages.criarSite.aiBadge',
    title:       'pages.criarSite.aiTitle',
    description: 'pages.criarSite.aiDesc',
    cta:         'pages.criarSite.aiCta',
    tag:         'pages.criarSite.aiTag',
  },
};

export default function CriarSite() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-12 sm:px-6 animate-fade-in">
      {/* Header */}
      <div className="mb-10 text-center max-w-xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {t('pages.criarSite.chooseMethodLabel')}
        </p>
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
          {t('pages.criarSite.chooseMethodTitle')}
        </h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          {t('pages.criarSite.chooseMethodDesc')}
        </p>
      </div>

      {/* Text lines */}
      <div className="w-full max-w-3xl space-y-8 text-left">
        {OPTION_CONFIGS.map((opt) => {
          const labels = OPTION_LABELS[opt.id];
          const badgeText = t(labels.badge);
          const showBadge = badgeText && badgeText !== labels.badge;

          const cta = opt.external ? (
            <button
              type="button"
              onClick={startBuilderOAuth}
              className="inline-flex text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
            >
              {t(labels.cta)}
            </button>
          ) : (
            <Link
              to={opt.href!}
              className="inline-flex text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
            >
              {t(labels.cta)}
            </Link>
          );

          return (
            <section key={opt.id} className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t(labels.tag)}
              </p>
              {showBadge && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                  {badgeText}
                </p>
              )}
              <p className="text-xl font-semibold text-foreground">{t(labels.title)}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{t(labels.description)}</p>
              {cta}
            </section>
          );
        })}
      </div>
    </div>
  );
}
