import { useState, useEffect } from "react";
import { Menu, X, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const Header = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = savedTheme === "dark" || (!savedTheme && prefersDark);
    setIsDark(shouldBeDark);
    if (shouldBeDark) document.documentElement.classList.add("dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    if (newTheme) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <header className="sticky top-0 z-50 py-2 sm:py-4">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 pill-nav px-4 sm:px-6">
          {/* Logo */}
          <div className="flex items-center min-w-0">
            <Link to="/" className="flex items-center gap-1.5 sm:gap-2">
              <img src="/android-chrome-192x192.png" alt="Laurena Studio" className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex-shrink-0" />
              <span className="font-bagel tracking-wider text-xl truncate">LAURENA STUDIO</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2 font-section">
            <a href="#funcionalidades" className="text-sm font-medium hover:bg-muted/60 rounded-full px-4 py-2 transition-all">
              {t("landing.header.features")}
            </a>
            <a href="#como-funciona" className="text-sm font-medium hover:bg-muted/60 rounded-full px-4 py-2 transition-all">
              {t("landing.header.howItWorks")}
            </a>
            <a href="#planos" className="text-sm font-medium hover:bg-muted/60 rounded-full px-4 py-2 transition-all">
              {t("landing.header.pricing")}
            </a>
            <Link to="/template" className="text-sm font-medium hover:bg-muted/60 rounded-full px-4 py-2 transition-all">
              {t("nav.template")}
            </Link>
            <Link to="/login" className="text-sm font-medium hover:bg-muted/60 rounded-full px-4 py-2 transition-all">
              {t("landing.header.login")}
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <LanguageSwitcher />
            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-full hover:bg-muted/60 transition-all"
              aria-label={t("landing.header.toggleTheme")}
            >
              {isDark ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
            </button>

            <Button asChild className="hidden md:flex bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 py-2 hover:scale-105 transition-all">
              <Link to="/registro">{t("landing.header.startFree")}</Link>
            </Button>

            <button
              className="md:hidden p-1.5 sm:p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={t("landing.header.menu")}
            >
              {isMenuOpen ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <Menu className="h-5 w-5 sm:h-6 sm:w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <nav className="flex flex-col gap-3 font-section">
              <a href="#funcionalidades" onClick={() => setIsMenuOpen(false)} className="text-sm font-medium hover:text-primary transition-colors">
                {t("landing.header.features")}
              </a>
              <a href="#como-funciona" onClick={() => setIsMenuOpen(false)} className="text-sm font-medium hover:text-primary transition-colors">
                {t("landing.header.howItWorks")}
              </a>
              <a href="#planos" onClick={() => setIsMenuOpen(false)} className="text-sm font-medium hover:text-primary transition-colors">
                {t("landing.header.pricing")}
              </a>
              <Link to="/template" onClick={() => setIsMenuOpen(false)} className="text-sm font-medium hover:text-primary transition-colors">
                {t("nav.template")}
              </Link>
              <Link to="/login" onClick={() => setIsMenuOpen(false)} className="text-sm font-medium hover:text-primary transition-colors">
                {t("landing.header.login")}
              </Link>
              <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full w-full mt-1">
                <Link to="/registro">{t("landing.header.startFree")}</Link>
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
