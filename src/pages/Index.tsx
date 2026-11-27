import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Check, Bot, BrainCircuit, Clapperboard, Mic,
  Zap, Crown, Building2, Play, ImageIcon, Video, Globe,
  Calendar, BarChart3, Megaphone, Library, ChevronRight,
  Monitor, Film, Spline, Sparkles, Link2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import Header from "@/components/Header";
import GoogleOneTap from "@/components/GoogleOneTap";
import { PLANOS } from "@/data/planos";
import { useTranslation } from "@/hooks/useTranslation";
import { useSEO } from "@/hooks/useSEO";

/* ── Static data (non-translated: images, hrefs, icons, colors) ── */

const FEATURED_META = [
  { id: "gptImage",      image: "/a4.jpeg",  video: "/video/feat1.mp4", href: "/ai-studio"    },
  { id: "veo3",          image: "/aza.jpeg", video: "/video/feat2.mp4", href: "/ai-studio"    },
  { id: "marketingApps", image: "/a5.jpeg",  video: "/video/feat3.mp4", href: "/marketing-ai" },
  { id: "nanoBananaPro", image: "/a1.jpeg",  video: "/video/feat4.mp4", href: "/ai-studio"    },
];

const SPOTLIGHT_META = { image: "/spotlight-marketing.png", href: "/marketing-ai" };

function getBuilderHomeUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:2020';
  const { hostname, protocol } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:2020';
  if (hostname === 'laurenastudio.pro') return 'https://dev.laurenastudio.pro';
  return `${protocol}//dev.${hostname}`;
}

const MODELS_META = [
  { id: "claude",  icon: Bot          },
  { id: "gemini",  icon: BrainCircuit },
  { id: "minimax", icon: Clapperboard },
  { id: "azure",   icon: Mic          },
];

const TOOLS_META = [
  { id: "image",     icon: ImageIcon, href: "/ai-studio",    color: "rgba(124,58,237,0.20)" },
  { id: "video",     icon: Video,     href: "/ai-studio",    color: "rgba(37,99,235,0.20)"  },
  { id: "marketing", icon: Megaphone, href: "/marketing-ai", color: "rgba(193,95,60,0.22)"  },
  { id: "site",      icon: Globe,     href: "/criar-site",   color: "rgba(16,185,129,0.18)" },
  { id: "audio",     icon: Mic,       href: "/ai-studio",    color: "rgba(236,72,153,0.18)" },
  { id: "agenda",    icon: Calendar,  href: "/agendador",    color: "rgba(6,182,212,0.18)"  },
  { id: "midia",     icon: Library,   href: "/midia",        color: "rgba(245,158,11,0.18)" },
  { id: "analytics", icon: BarChart3, href: "/analytics",    color: "rgba(20,184,166,0.18)" },
];

const PLAN_ICONS = { starter: Zap, pro: Crown, business: Building2 };

/* ─────────────────────────── COMPONENTS ─────────────────────────── */

/* ── BLOCK 1 · Featured grid — 4 equal-column cards ── */
function FeaturedGrid({ withVideo = false }: { withVideo?: boolean }) {
  const { t } = useTranslation();
  return (
    <section className="ls-section-wrap">
      <p className="ls-section-label">{t("landing.featured.label")}</p>
      <div className="ls-feat-grid">
        {FEATURED_META.map((c) => (
          <Link key={c.id} to={c.href} className="ls-feat-card">
            {withVideo ? (
              <video
                src={c.video}
                poster={c.image}
                className="ls-card-img"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-hidden="true"
              />
            ) : (
              <img src={c.image} alt="" className="ls-card-img" />
            )}
            <div className="ls-card-grad" />
            <div className="ls-feat-play">
              <Play className="w-3.5 h-3.5" fill="currentColor" />
            </div>
            <div className="ls-feat-body">
              <div className="ls-feat-row">
                <span className="ls-feat-cat">{t(`landing.featured.cards.${c.id}.cat`)}</span>
                <span className="ls-feat-badge">{t(`landing.featured.cards.${c.id}.badge`)}</span>
              </div>
              <div className="ls-feat-title">{t(`landing.featured.cards.${c.id}.title`)}</div>
              <div className="ls-feat-desc">{t(`landing.featured.cards.${c.id}.desc`)}</div>
              <div className="ls-feat-prompt">{t(`landing.featured.cards.${c.id}.prompt`)}</div>
              <div className="ls-try-btn">{t("landing.featured.tryModel")} <ArrowRight className="w-3 h-3" /></div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── BLOCK 2 · Spotlight banner ── */
function SpotlightBanner() {
  const { t } = useTranslation();
  const headline = t("landing.spotlight.headline");
  return (
    <section className="ls-section-wrap">
      <Link to={SPOTLIGHT_META.href} className="ls-spotlight">
        <img src={SPOTLIGHT_META.image} alt={t("landing.spotlight.title")} className="ls-spotlight-img" />
        <div className="ls-spotlight-grad" />
        <div className="ls-spotlight-body">
          <div className="ls-feat-row" style={{ marginBottom: 16 }}>
            <span className="ls-feat-cat">{t("landing.spotlight.cat")}</span>
            <span className="ls-feat-badge">{t("landing.spotlight.badge")}</span>
          </div>
          <h2 className="ls-spotlight-h2">
            {headline.split("\n").map((line: string, i: number) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </h2>
          <p className="ls-spotlight-desc">{t("landing.spotlight.desc")}</p>
          <div className="ls-try-btn" style={{ marginTop: 24 }}>
            {t("landing.spotlight.cta")} <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </Link>
    </section>
  );
}

/* ── BLOCK 3 · Split section ── */
function SplitPromo() {
  const { t } = useTranslation();
  return (
    <section className="ls-split-section">
      <div className="ls-split-inner">
        <div className="ls-split-left">
          <div className="ls-eyebrow">{t("landing.split.eyebrow")}</div>
          <h2 className="ls-split-h2">
            {t("landing.split.title")}<br />
            <span className="ls-grad-text ls-serif-italic">{t("landing.split.highlight")}</span>
          </h2>
          <p className="ls-split-sub">{t("landing.split.sub")}</p>
          <div className="ls-split-input-row">
            <input
              type="url"
              className="ls-split-input"
              placeholder={t("landing.split.placeholder")}
              aria-label={t("landing.split.placeholder")}
            />
            <a href={getBuilderHomeUrl()} className="ls-split-input-btn">
              {t("landing.split.inputBtn")} <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <Link to="/registro" className="ls-split-link">
            {t("landing.split.altLink")}
          </Link>
        </div>
        <div className="ls-split-right">
          <div className="ls-split-img-wrap">
            <img src="/a4.jpeg" alt="" className="ls-split-img" />
            <div className="ls-split-img-border" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── BLOCK 4 · Promo banner ── */
function PromoBanner() {
  const { t } = useTranslation();
  return (
    <section className="ls-section-wrap">
      <div className="ls-promo-banner" style={{ backgroundImage: "url(/aza.jpeg)" }}>
        <div className="ls-promo-grad" />
        <div className="ls-promo-body">
          <div className="ls-eyebrow">{t("landing.promo.eyebrow")}</div>
          <h2 className="ls-promo-h2">
            {t("landing.promo.title")}<br />
            <span className="ls-promo-accent">{t("landing.promo.highlight")}</span>
          </h2>
          <p className="ls-promo-sub">{t("landing.promo.sub")}</p>
          <div className="ls-promo-btns">
            <Link to="/registro" className="ls-btn-primary">{t("landing.promo.primary")}</Link>
            <a href="#planos" className="ls-btn-ghost">{t("landing.promo.secondary")}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── BLOCK 5 · Originals banner ── */
function OriginalsBanner() {
  const { t } = useTranslation();
  return (
    <section className="ls-section-wrap">
      <div className="ls-originals">
        <div className="ls-originals-visual">
          <img src="/video/image (1).png" alt="" />
        </div>
        <div className="ls-originals-text">
          <div className="ls-eyebrow">{t("landing.originals.eyebrow")}</div>
          <h2 className="ls-originals-h2">
            {t("landing.originals.title")}<br />
            <span className="ls-grad-text">{t("landing.originals.highlight")}</span>
          </h2>
          <p className="ls-originals-sub">{t("landing.originals.sub")}</p>
          <a href={getBuilderHomeUrl()} className="ls-btn-primary">
            {t("landing.originals.cta")} <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ── BLOCK 6 · Tools grid ── */
function ToolsGrid() {
  const { t } = useTranslation();
  return (
    <section className="ls-section-wrap">
      <p className="ls-section-label">{t("landing.tools.label")}</p>
      <div className="ls-tools-header">
        <div className="ls-section-title">{t("landing.tools.title")}</div>
        <div className="ls-section-sub">{t("landing.tools.sub")}</div>
      </div>
      <div className="ls-tools-grid">
        {TOOLS_META.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.id}
              to={tool.href}
              className="ls-tool-card"
              style={{ background: `linear-gradient(145deg, ${tool.color} 0%, rgba(15,17,19,0) 55%)` }}
            >
              <div className="ls-tool-icon">
                <Icon className="w-5 h-5" strokeWidth={1.6} />
              </div>
              <div className="ls-tool-text">
                <div className="ls-tool-label">{t(`landing.tools.${tool.id}.label`)}</div>
                <div className="ls-tool-desc">{t(`landing.tools.${tool.id}.desc`)}</div>
              </div>
              <div className="ls-tool-arrow">
                <ChevronRight className="w-4 h-4" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ── BLOCK 7 · Engines horizontal scroll ── */
function EnginesScroll() {
  const { t } = useTranslation();
  return (
    <section className="ls-section-wrap">
      <div className="ls-engines-top">
        <div>
          <p className="ls-section-label" style={{ marginBottom: 8 }}>{t("landing.engines.label")}</p>
          <div className="ls-section-title">
            {t("landing.engines.title").split("\n").map((line: string, i: number) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </div>
        </div>
        <Link to="/dashboard" className="ls-engines-more">
          {t("landing.engines.viewAll")} <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="ls-engines-scroll">
        {[...MODELS_META, ...MODELS_META].map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="ls-engine-card">
              <div className="ls-engine-icon">
                <Icon className="w-5 h-5" strokeWidth={1.6} />
              </div>
              <div className="ls-engine-use">{t(`landing.engines.${m.id}.use`)}</div>
              <div className="ls-engine-name">{t(`landing.engines.${m.id}.name`)}</div>
              <div className="ls-engine-desc">{t(`landing.engines.${m.id}.desc`)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── BLOCK 7c · AI Showcase (Generate Image + tool cards) ── */
const SHOWCASE_TOOLS = [
  { id: "video",    icon: Video,    href: "/ai-studio",    badge: null,        title: "Video Creator",       desc: "Craft polished clips in minutes" },
  { id: "veo3",     icon: BarChart3, href: "/ai-studio",  badge: "NEW",        title: "Veo 3",               desc: "Native 4K video generation by Google" },
  { id: "nano",     icon: Globe,    href: "/ai-studio",    badge: "UNLIMITED",  title: "Nano Banana Pro",     desc: "Generate high-quality visuals" },
  { id: "mktg",     icon: Monitor,  href: "/marketing-ai", badge: "NEW",       title: "Campaign Studio",     desc: "Turn one brief into multi-channel assets" },
  { id: "cinema",   icon: Film,     href: "/ai-studio",    badge: null,        title: "Cinema Suite 4.0",    desc: "Go from storyboard to final scene with AI" },
  { id: "sora2",    icon: Spline,   href: "/ai-studio",    badge: "SORA 2",    title: "Sora 2",              desc: "OpenAI's most advanced text-to-video model" },
] as const;

function AIShowcase() {
  return (
    <section className="ls-section-wrap">
      <div className="ls-showcase">
        {/* Left — Generate Image card */}
        <Link to="/ai-studio" className="ls-showcase-left">
          <div className="ls-showcase-glow" />
          <div className="ls-showcase-left-content">
            <div className="ls-showcase-left-text">
              <div className="ls-showcase-title">Image Lab</div>
              <div className="ls-showcase-desc">Write a prompt and build a fresh visual</div>
            </div>
            <img src="/a4.jpeg" alt="" className="ls-showcase-photo" />
          </div>
          <div className="ls-showcase-generate-btn">Create Visual</div>
        </Link>

        {/* Right — 3×2 tool cards */}
        <div className="ls-showcase-grid">
          {SHOWCASE_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const badgeClass =
              tool.badge === "NEW" ? "ls-showcase-badge--new" :
              tool.badge ? "ls-showcase-badge--premium" : "";
            return (
              <Link key={tool.id} to={tool.href} className="ls-showcase-card">
                <div className="ls-showcase-card-top">
                  <div className="ls-showcase-icon"><Icon className="w-4 h-4" strokeWidth={1.6} /></div>
                  {tool.badge && <span className={`ls-showcase-badge ${badgeClass}`}>{tool.badge}</span>}
                </div>
                <div className="ls-showcase-card-title">{tool.title}</div>
                <div className="ls-showcase-card-desc">{tool.desc}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── BLOCK 7d · Marketing Showcase ── */
const MKTG_LEFT_VIDEOS  = ["/video/transferir (1).mp4", "/video/transferir (1) copy.mp4"];
const MKTG_GRID_VIDEOS  = [
  "/video/transferir (2).mp4",   // c1 top-half
  "/video/transferir (3).mp4",   // c1 bottom-half
  "/video/feat1.mp4",            // c2 full height
  "/video/transferir (5).mp4",   // c3 top-half
  "/video/transferir (6).mp4",   // c3 mid
  "/video/transferir (7).mp4",   // c3 bottom (CTA overlay)
  "/video/transferir (8).mp4",   // c4 top-half
  "/video/transferir (9).mp4",   // c4 mid
  "/video/transferir (10).mp4",  // c4 bottom
];

/* ── BLOCK 7e · Marketing Showcase 2 (vid2) ── */
const MKTG2_LEFT_VIDEOS = [
  "/video/vid2/transferir (26).mp4",
  "/video/vid2/transferir (27).mp4",
];
const MKTG2_GRID_VIDEOS = [
  "/video/vid2/transferir (28).mp4",  // c1 top-half
  "/video/vid2/transferir (29).mp4",  // c1 bottom-half
  "/video/vid2/transferir (30).mp4",  // c2 full height
  "/video/vid2/transferir (31).mp4",  // c3 top-half
  "/video/vid2/transferir (32).mp4",  // c3 mid
  "/video/vid2/transferir (26).mp4",  // c3 bottom (CTA overlay)
  "/video/vid2/transferir (27).mp4",  // c4 top-half
  "/video/vid2/transferir (28).mp4",  // c4 mid
  "/video/vid2/transferir (29).mp4",  // c4 bottom
];

function MarketingShowcase() {
  const { t } = useTranslation();
  return (
    <section className="ls-section-wrap">
      <div className="ls-mktg">

        {/* ── Left card ── */}
        <div className="ls-mktg-left">
          <div className="ls-mktg-glow" />

          <div className="ls-mktg-top">
            <h2 className="ls-mktg-title">{t("landing.marketingShowcase.titleTop")}<br />{t("landing.marketingShowcase.titleBottom")}</h2>
            <p className="ls-mktg-sub">{t("landing.marketingShowcase.subtitle")}</p>
            <Link to="/marketing-ai" className="ls-mktg-cta-btn">
              <Sparkles className="w-4 h-4" /> {t("landing.marketingShowcase.cta")}
            </Link>
          </div>

          <div className="ls-mktg-mockup">
            <video src={MKTG_LEFT_VIDEOS[0]} autoPlay muted loop playsInline className="ls-mktg-mock-v1" />
            <video src={MKTG_LEFT_VIDEOS[1]} autoPlay muted loop playsInline className="ls-mktg-mock-v2" />
          </div>

          <Link to="/marketing-ai" className="ls-mktg-input-row">
            <Link2 className="w-3.5 h-3.5 shrink-0 opacity-50" />
            <span className="ls-mktg-input-placeholder">{t("landing.marketingShowcase.inputPlaceholder")}</span>
            <span className="ls-mktg-input-arrow"><ArrowRight className="w-4 h-4" /></span>
          </Link>

          <div className="ls-mktg-footer-links">
            <span><Link2 className="w-3 h-3" /> {t("landing.marketingShowcase.linkProduct")}</span>
            <span><Monitor className="w-3 h-3" /> {t("landing.marketingShowcase.linkApp")}</span>
          </div>
        </div>

        {/* ── Right video mosaic ── */}
        <div className="ls-mktg-grid">
          {/* col 1 */}
          <video src={MKTG_GRID_VIDEOS[0]} autoPlay muted loop playsInline className="ls-mv ls-mv-c1r1" />
          <video src={MKTG_GRID_VIDEOS[1]} autoPlay muted loop playsInline className="ls-mv ls-mv-c1r5" />
          {/* col 2 – full height */}
          <video src={MKTG_GRID_VIDEOS[2]} autoPlay muted loop playsInline className="ls-mv ls-mv-c2" />
          {/* col 3 */}
          <video src={MKTG_GRID_VIDEOS[3]} autoPlay muted loop playsInline className="ls-mv ls-mv-c3r1" />
          <video src={MKTG_GRID_VIDEOS[4]} autoPlay muted loop playsInline className="ls-mv ls-mv-c3r5" />
          <div className="ls-mv ls-mv-c3r7 ls-mv-cta">
            <video src={MKTG_GRID_VIDEOS[5]} autoPlay muted loop playsInline className="ls-mv-bg" />
            <Link to="/marketing-ai" className="ls-mktg-view-all">
              {t("landing.marketingShowcase.viewAll")} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {/* col 4 */}
          <video src={MKTG_GRID_VIDEOS[6]} autoPlay muted loop playsInline className="ls-mv ls-mv-c4r1" />
          <video src={MKTG_GRID_VIDEOS[7]} autoPlay muted loop playsInline className="ls-mv ls-mv-c4r5" />
          <video src={MKTG_GRID_VIDEOS[8]} autoPlay muted loop playsInline className="ls-mv ls-mv-c4r7" />
        </div>
      </div>
    </section>
  );
}

function MarketingShowcase2() {
  const { t } = useTranslation();
  return (
    <section className="ls-section-wrap">
      <div className="ls-mktg">

        {/* ── Left card ── */}
        <div className="ls-mktg-left">
          <div className="ls-mktg-glow" />

          <div className="ls-mktg-top">
            <h2 className="ls-mktg-title">{t("landing.marketingShowcase.titleTop")}<br />{t("landing.marketingShowcase.titleBottom")}</h2>
            <p className="ls-mktg-sub">{t("landing.marketingShowcase.subtitle")}</p>
            <Link to="/marketing-ai" className="ls-mktg-cta-btn">
              <Sparkles className="w-4 h-4" /> {t("landing.marketingShowcase.cta")}
            </Link>
          </div>

          <div className="ls-mktg-mockup">
            <video src={MKTG2_LEFT_VIDEOS[0]} autoPlay muted loop playsInline className="ls-mktg-mock-v1" />
            <video src={MKTG2_LEFT_VIDEOS[1]} autoPlay muted loop playsInline className="ls-mktg-mock-v2" />
          </div>

          <Link to="/marketing-ai" className="ls-mktg-input-row">
            <Link2 className="w-3.5 h-3.5 shrink-0 opacity-50" />
            <span className="ls-mktg-input-placeholder">{t("landing.marketingShowcase.inputPlaceholder")}</span>
            <span className="ls-mktg-input-arrow"><ArrowRight className="w-4 h-4" /></span>
          </Link>

          <div className="ls-mktg-footer-links">
            <span><Link2 className="w-3 h-3" /> {t("landing.marketingShowcase.linkProduct")}</span>
            <span><Monitor className="w-3 h-3" /> {t("landing.marketingShowcase.linkApp")}</span>
          </div>
        </div>

        {/* ── Right video mosaic ── */}
        <div className="ls-mktg-grid">
          {/* col 1 */}
          <video src={MKTG2_GRID_VIDEOS[0]} autoPlay muted loop playsInline className="ls-mv ls-mv-c1r1" />
          <video src={MKTG2_GRID_VIDEOS[1]} autoPlay muted loop playsInline className="ls-mv ls-mv-c1r5" />
          {/* col 2 – full height */}
          <video src={MKTG2_GRID_VIDEOS[2]} autoPlay muted loop playsInline className="ls-mv ls-mv-c2" />
          {/* col 3 */}
          <video src={MKTG2_GRID_VIDEOS[3]} autoPlay muted loop playsInline className="ls-mv ls-mv-c3r1" />
          <video src={MKTG2_GRID_VIDEOS[4]} autoPlay muted loop playsInline className="ls-mv ls-mv-c3r5" />
          <div className="ls-mv ls-mv-c3r7 ls-mv-cta">
            <video src={MKTG2_GRID_VIDEOS[5]} autoPlay muted loop playsInline className="ls-mv-bg" />
            <Link to="/marketing-ai" className="ls-mktg-view-all">
              {t("landing.marketingShowcase.viewAll")} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {/* col 4 */}
          <video src={MKTG2_GRID_VIDEOS[6]} autoPlay muted loop playsInline className="ls-mv ls-mv-c4r1" />
          <video src={MKTG2_GRID_VIDEOS[7]} autoPlay muted loop playsInline className="ls-mv ls-mv-c4r5" />
          <video src={MKTG2_GRID_VIDEOS[8]} autoPlay muted loop playsInline className="ls-mv ls-mv-c4r7" />
        </div>
      </div>
    </section>
  );
}

/* ── BLOCK 8 · Cinema banner ── */
function CinemaBanner() {
  const { t } = useTranslation();
  return (
    <section className="ls-section-wrap">
      <div className="ls-cinema-banner">
        <video
          src="/video/transferir (24).mp4"
          className="ls-cinema-video"
          autoPlay muted loop playsInline
        />
        <div className="ls-cinema-grad" />
        <div className="ls-cinema-body">
          <div className="ls-eyebrow">{t("landing.cinema.eyebrow")}</div>
          <h2 className="ls-cinema-h2">
            {t("landing.cinema.title").split("\n").map((line: string, i: number) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </h2>
          <p className="ls-cinema-sub">{t("landing.cinema.sub")}</p>
          <Link to="/ai-studio" className="ls-btn-primary" style={{ marginTop: 28 }}>
            {t("landing.cinema.cta")} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── BLOCK 9 · Pricing ── */
function Pricing() {
  const [anual, setAnual] = useState(true);
  const { t } = useTranslation();
  return (
    <section id="planos" className="ls-section-wrap scroll-mt-20">
      <p className="ls-section-label">{t("landing.pricingSection.label")}</p>
      <div className="ls-pricing-top">
        <div className="ls-section-title">{t("landing.pricingSection.title")}</div>
        <div className="ls-section-sub">{t("landing.pricingSection.sub")}</div>
      </div>
      <div className="ls-toggle-row">
        <span className={`ls-toggle-label${!anual ? " active" : ""}`}>{t("landing.plans.monthly")}</span>
        <Switch checked={anual} onCheckedChange={setAnual} />
        <span className={`ls-toggle-label${anual ? " active" : ""}`}>{t("landing.plans.annual")}</span>
        {anual && <span className="ls-economy-badge">{t("landing.pricingSection.economy")}</span>}
      </div>
      <div className="ls-pricing-grid">
        {PLANOS.map((p) => {
          const Icon = PLAN_ICONS[p.id as keyof typeof PLAN_ICONS];
          const preco = anual ? p.precoAnual : p.preco;
          return (
            <div key={p.id} className={`ls-pricing-card${p.destaque ? " featured" : ""}`}>
              {p.destaque && <span className="ls-plan-badge">{t("landing.pricingSection.popular")}</span>}
              <div className="ls-plan-header">
                <div className="ls-plan-icon"><Icon className="w-4 h-4" /></div>
                <div className="ls-plan-name">{p.nome}</div>
              </div>
              <div className="ls-plan-price"><sup>R$</sup>{preco}</div>
              <div className="ls-plan-period">
                /mês{anual && ` · ${t("landing.pricingSection.billedAnnually")}`}
              </div>
              <ul className="ls-plan-features">
                {p.recursos.map((r, i) => (
                  <li key={i}><Check className="w-3.5 h-3.5" />{r}</li>
                ))}
              </ul>
              <Link to="/login" className="ls-plan-cta">
                {p.id === "business"
                  ? t("landing.pricingSection.ctaSales")
                  : p.destaque
                    ? t("landing.pricingSection.ctaSubscribe", { name: p.nome })
                    : t("landing.pricingSection.ctaStart")}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── BLOCK 10 · CTA ── */
function CTA() {
  const { t } = useTranslation();
  return (
    <section className="ls-section-wrap">
      <div className="ls-cta-box">
        <div className="ls-cta-glow" />
        <div className="ls-section-title" style={{ marginBottom: 12, position: "relative" }}>
          {t("landing.ctaSection.title")}
        </div>
        <p className="ls-cta-sub">{t("landing.ctaSection.sub")}</p>
        <div className="ls-cta-btns">
          <Link to="/registro" className="ls-btn-primary">
            {t("landing.ctaSection.primary")} <ArrowRight className="w-4 h-4" />
          </Link>
          <a href="#planos" className="ls-btn-ghost">{t("landing.ctaSection.secondary")}</a>
        </div>
      </div>
    </section>
  );
}

/* ── FOOTER ── */
function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="ls-footer">
      <div className="ls-footer-inner">
        <div className="ls-footer-brand">
          <Link to="/" className="ls-logo">
            <img src="/android-chrome-192x192.png" alt="" className="w-7 h-7 rounded-lg" />
            <span className="ls-logo-text">LAURENA</span>
          </Link>
          <p>{t("landing.footerSection.brand")}</p>
        </div>
        <div className="ls-footer-col">
          <h4>{t("landing.footerSection.product")}</h4>
          <ul>
            <li><Link to="/ai-studio">AI Studio</Link></li>
            <li><Link to="/marketing-ai">Marketing AI</Link></li>
            <li><a href={getBuilderHomeUrl()}>{t("landing.tools.site.label")}</a></li>
            <li><Link to="/agendador">{t("landing.tools.agenda.label")}</Link></li>
            <li><Link to="/dashboard">Dashboard</Link></li>
          </ul>
        </div>
        <div className="ls-footer-col">
          <h4>{t("landing.footerSection.platform")}</h4>
          <ul>
            <li><Link to="/login">{t("landing.header.login")}</Link></li>
            <li><Link to="/registro">{t("landing.header.startFree")}</Link></li>
            <li><a href="#planos">{t("landing.header.pricing")}</a></li>
            <li><Link to="/analytics">{t("landing.tools.analytics.label")}</Link></li>
          </ul>
        </div>
        <div className="ls-footer-col">
          <h4>{t("landing.footerSection.legal")}</h4>
          <ul>
            <li><a href="/privacidade.html">{t("landing.footer.links.privacy")}</a></li>
            <li><a href="/termos.html">{t("landing.footer.links.terms")}</a></li>
            <li><a href="/termos-ia.html">{t("landing.footer.links.termsAi")}</a></li>
            <li><Link to="/delete-my-data">Dados pessoais</Link></li>
          </ul>
        </div>
      </div>
      <div className="ls-footer-bottom">
        <span>{t("landing.footerSection.copyright", { year: new Date().getFullYear() })}</span>
      </div>
    </footer>
  );
}

/* ─────────────────────────── PAGE ─────────────────────────── */

export default function Index() {
  const { t } = useTranslation();
  useSEO({ description: t("seo.description"), url: "/" });

  return (
    <div className="ls-landing">
      <GoogleOneTap />
      <Header />

      {/* 1 · Featured grid — videos */}
      <FeaturedGrid withVideo />

      {/* 2 · Spotlight full-width banner */}
      <SpotlightBanner />

      {/* 3 · Split "Crie qualquer coisa" */}
      <SplitPromo />

      {/* 4 · Promo banner */}
      <PromoBanner />

      {/* 5 · Originals / Website creation */}
      <OriginalsBanner />

      {/* 6 · Tools grid 4×2 */}
      <ToolsGrid />

      {/* 7 · AI Engines horizontal scroll */}
      <EnginesScroll />

      {/* 7b · Second featured grid — images */}
      <FeaturedGrid />

      {/* 7c · AI Showcase */}
      <AIShowcase />

      {/* 7d · Marketing Showcase */}
      <MarketingShowcase />

      {/* 7e · Marketing Showcase 2 */}
      <MarketingShowcase2 />

      {/* 8 · Cinema/Video promo banner */}
      <CinemaBanner />

      {/* 9 · Pricing */}
      <Pricing />

      {/* 10 · CTA */}
      <CTA />

      <Footer />
    </div>
  );
}
