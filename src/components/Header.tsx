import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { triggerGoogleSignIn } from "@/components/GoogleOneTap";
import {
  Compass, Image, Video, Mic, Users, Pencil, User,
  Megaphone, Clapperboard, Sparkles, LayoutGrid, Bot,
  Heart, Menu, X,
} from "lucide-react";

const CATEGORIES = [
  { id: "explore", icon: Compass, href: "/dashboard" },
  { id: "image", icon: Image, href: "/ai-studio" },
  { id: "video", icon: Video, href: "/ai-studio" },
  { id: "audio", icon: Mic, href: "/ai-studio" },
  { id: "collab", icon: Users, href: "/dashboard" },
  { id: "edit", icon: Pencil, href: "/editor" },
  { id: "character", icon: User, href: "/ai-studio" },
  { id: "marketing", icon: Megaphone, href: "/marketing-ai", badge: "new" },
  { id: "cinema", icon: Clapperboard, href: "/ai-studio", ver: "4.0" },
  { id: "originals", icon: Sparkles, href: "/dashboard", badge: "new" },
  { id: "apps", icon: LayoutGrid, href: "/dashboard" },
  { id: "assist", icon: Bot, href: "/dashboard" },
  { id: "community", icon: Heart, href: "/dashboard" },
] as const;

export default function Header() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <header className="ls-header">
      <div className="ls-header-inner">
        {/* Logo */}
        <Link to="/" className="ls-logo">
          <img src="/android-chrome-192x192.png" alt={t("app.title")} className="w-7 h-7 rounded-lg" />
          <span className="ls-logo-text">LAURENA</span>
        </Link>

        {/* Categories scroll */}
        <nav className="ls-nav-scroll" aria-label={t("landing.header.categoriesNavLabel")}>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <Link key={c.id} to={c.href} className="ls-nav-item">
                <Icon className="w-3 h-3 opacity-70" />
                {t(`landing.header.navItems.${c.id}`)}
                {"badge" in c && c.badge && <span className="ls-nav-badge">{t(`landing.header.badges.${c.badge}`)}</span>}
                {"ver" in c && c.ver && <span className="ls-nav-ver">{c.ver}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="ls-nav-actions">
          <a href="/#planos" className="ls-pricing-link">
            {t("landing.header.pricing")}
            <span className="ls-sale-badge">{t("landing.header.badges.sale")}</span>
          </a>
          <button type="button" className="ls-login-link" onClick={triggerGoogleSignIn}>{t("landing.header.login")}</button>
          <Link to="/registro" className="ls-signup-btn">{t("landing.header.startFree")}</Link>
        </div>

        {/* Mobile toggle */}
        <button className="ls-menu-btn" onClick={() => setOpen(!open)} aria-label={t("landing.header.menu")}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="ls-mobile-menu">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <Link key={c.id} to={c.href} className="ls-mobile-item" onClick={() => setOpen(false)}>
                <Icon className="w-4 h-4 opacity-60" />
                {t(`landing.header.navItems.${c.id}`)}
                {"badge" in c && c.badge && <span className="ls-nav-badge">{t(`landing.header.badges.${c.badge}`)}</span>}
              </Link>
            );
          })}
          <div className="ls-mobile-divider" />
          <a href="/#planos" className="ls-mobile-item" onClick={() => setOpen(false)}>
            {t("landing.header.pricing")} <span className="ls-sale-badge">{t("landing.header.badges.sale")}</span>
          </a>
          <button type="button" className="ls-mobile-item" onClick={() => { setOpen(false); triggerGoogleSignIn(); }}>{t("landing.header.login")}</button>
          <Link to="/registro" className="ls-signup-btn" style={{ margin: "8px 12px 0" }} onClick={() => setOpen(false)}>
            {t("landing.header.startFree")}
          </Link>
        </div>
      )}
    </header>
  );
}
