import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import HeroInferenceDemo from "@/components/HeroInferenceDemo";
import { useTranslation } from "@/hooks/useTranslation";

const HeroSection = () => {
  const { t } = useTranslation();

  return (
    <section className="relative rounded-2xl md:rounded-[2.5rem] overflow-hidden bg-card animate-fade-in border border-border h-[calc(100vh-5.5rem)] min-h-[400px] flex flex-col">
      {/* Imagem hero — <img> + preload no index para prioridade do browser (L mais rápido que background-image) */}
      <img
        src="/aza.jpeg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        fetchPriority="high"
        decoding="async"
        loading="eager"
      />
      {/* Overlay leve para legibilidade do texto sem esconder a imagem */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/25 to-transparent" />

      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0 flex-1 min-h-0 items-center md:items-stretch">
        {/* Lado esquerdo: conteúdo sobre a imagem hero */}
        <div className="relative flex flex-col justify-center items-start p-4 sm:p-6 md:p-10 lg:p-12 min-h-0 overflow-hidden order-2 md:order-1">
          <div className="w-full max-w-xl text-white">
            <h1 className="font-inter text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-[1.35] tracking-tight animate-slide-down drop-shadow-lg mb-4 md:mb-6">
              {t("landing.hero.titleBefore")}{" "}
              <span className="text-white font-semibold">
                {t("landing.hero.titleHighlight")}
              </span>
            </h1>
            <p className="font-inter text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed animate-slide-up drop-shadow-md mb-6 md:mb-8 text-[hsl(40,30%,96%)]">
              {t("landing.hero.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 animate-slide-up">
              <Button asChild size="lg" className="rounded-full px-6 sm:px-8 sm:w-auto hover:scale-105 transition-all gap-2">
                <Link to="/registro">
                  {t("landing.hero.ctaPrimary")}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="rounded-full gap-2 text-white/80 hover:text-white hover:bg-white/10 sm:w-auto">
                <Link to="/login">
                  <Play className="w-4 h-4 fill-current" />
                  {t("landing.hero.ctaSecondary")}
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Lado direito: inferência IA ao vivo sobre a imagem hero */}
        <div className="relative flex items-center justify-center p-4 sm:p-6 md:p-10 min-h-0 w-full order-1 md:order-2">
          <div className="w-full max-w-[360px] md:max-w-[380px] flex justify-center animate-scale-in shrink-0">
            <HeroInferenceDemo />
          </div>
          <div className="absolute bottom-3 right-3 md:bottom-5 md:right-5 bg-background rounded-xl border border-border shadow-lg px-2 py-1.5 md:px-3 md:py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-mono text-[11px] font-normal uppercase tracking-widest text-foreground/90">
              {t("landing.hero.live")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
