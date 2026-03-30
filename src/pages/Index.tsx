import { useState, useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import IntroSection from "@/components/IntroSection";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  BrainCircuit,
  Megaphone,
  Globe,
  Check,
  X,
  ArrowRight,
  Zap,
  Crown,
  Building2,
  Bot,
  Clapperboard,
} from "lucide-react";
import { PLANOS } from "@/data/planos";

const iconesPlano = {
  starter: Zap,
  pro: Crown,
  business: Building2,
};

const Index = () => {
  const [anual, setAnual] = useState(true);
  const { t } = useTranslation();

  const funcionalidades = useMemo(
    () => [
      {
        icon: Megaphone,
        titulo: t("landing.features.ads.title"),
        descricao: t("landing.features.ads.desc"),
        href: "/login",
        imagem: "/a4.jpeg",
        gradient: "from-blue-600/90 to-blue-500/70",
        ring: "group-hover:ring-blue-500/30",
        chip: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
        accentLabel: t("landing.features.ads.accent"),
      },
      {
        icon: BrainCircuit,
        titulo: t("landing.features.content.title"),
        descricao: t("landing.features.content.desc"),
        href: "/login",
        imagem: "/a5.jpeg",
        gradient: "from-primary to-primary/80",
        ring: "group-hover:ring-primary/35",
        chip: "bg-primary/10 text-primary",
        accentLabel: t("landing.features.content.accent"),
      },
      {
        icon: Globe,
        titulo: t("landing.features.site.title"),
        descricao: t("landing.features.site.desc"),
        href: "/login",
        imagem: "/pexels-mart-production-7679865.jpg",
        gradient: "from-amber-600/90 to-amber-500/70",
        ring: "group-hover:ring-amber-500/30",
        chip: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
        accentLabel: t("landing.features.site.accent"),
      },
    ],
    [t]
  );

  const passos = useMemo(
    () => [
      {
        numero: "01",
        titulo: t("landing.howItWorks.steps.1.title"),
        descricao: t("landing.howItWorks.steps.1.desc"),
      },
      {
        numero: "02",
        titulo: t("landing.howItWorks.steps.2.title"),
        descricao: t("landing.howItWorks.steps.2.desc"),
      },
      {
        numero: "03",
        titulo: t("landing.howItWorks.steps.3.title"),
        descricao: t("landing.howItWorks.steps.3.desc"),
      },
    ],
    [t]
  );

  const modelosIA = useMemo(
    () => [
      {
        nome: t("landing.models.claude.name"),
        uso: t("landing.models.claude.use"),
        descricao: t("landing.models.claude.desc"),
        icon: Bot,
        tag: t("landing.models.claude.tag"),
      },
      {
        nome: t("landing.models.gemini.name"),
        uso: t("landing.models.gemini.use"),
        descricao: t("landing.models.gemini.desc"),
        icon: BrainCircuit,
        tag: t("landing.models.gemini.tag"),
      },
      {
        nome: t("landing.models.minimax.name"),
        uso: t("landing.models.minimax.use"),
        descricao: t("landing.models.minimax.desc"),
        icon: Clapperboard,
        tag: t("landing.models.minimax.tag"),
      },
    ],
    [t]
  );

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <HeroSection />

        {/* Stats */}
        <IntroSection />

        {/* Funcionalidades — layout marketing com imagens */}
        <section id="funcionalidades" className="py-12 md:py-20 scroll-mt-20">
          <div className="relative mb-10 md:mb-14 max-w-3xl mx-auto space-y-4 text-center animate-slide-up">
            <Badge
              variant="outline"
              className="rounded-full border-primary/25 bg-primary/5 px-4 py-1 font-mono text-[11px] font-normal uppercase tracking-widest text-primary"
            >
              {t("landing.featuresSection.badge")}
            </Badge>
            <h2 className="text-3xl font-bold leading-snug tracking-[-0.01em] md:text-4xl lg:text-[2.35rem]">
              {t("landing.featuresSection.titleBefore")}{" "}
              <span className="text-primary">{t("landing.featuresSection.titleHighlight")}</span>
            </h2>
            <p className="text-base font-light leading-[1.6] text-muted-foreground md:text-lg">
              {t("landing.featuresSection.subtitle")}
            </p>
          </div>

          <div className="flex flex-col gap-12 md:gap-16 lg:gap-20">
            {funcionalidades.map((f, i) => {
              const Icon = f.icon;
              const reverse = i % 2 === 1;
              return (
                <Link
                  key={`feat-${i}`}
                  to={f.href}
                  className={`group relative grid gap-8 rounded-[1.75rem] border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm transition-all duration-500 hover:border-primary/20 hover:shadow-lg md:grid-cols-2 md:items-stretch md:gap-0 md:overflow-hidden lg:rounded-[2rem] ${f.ring} hover:ring-2 animate-slide-up stagger-${Math.min(i + 1, 3)}`}
                >
                  {/* Imagem */}
                  <div
                    className={`relative min-h-[220px] overflow-hidden md:min-h-[300px] lg:min-h-[340px] ${
                      reverse ? "md:order-2" : "md:order-1"
                    }`}
                  >
                    <img
                      src={f.imagem}
                      alt=""
                      className="h-full w-full min-h-[220px] object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03] md:min-h-[300px] lg:min-h-[340px]"
                      loading={f.imagem.includes("pexels-mart-production") ? "eager" : "lazy"}
                      decoding="async"
                      fetchPriority={f.imagem.includes("pexels-mart-production") ? "high" : "auto"}
                    />
                    <div
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent md:from-background/40"
                      aria-hidden
                    />
                    <div className="absolute left-4 top-4 flex items-center gap-2 md:left-5 md:top-5">
                      <span
                        className={`rounded-full bg-background/90 px-3 py-1 font-mono text-[10px] font-normal uppercase tracking-widest text-foreground shadow-sm backdrop-blur-sm md:text-[11px] ${f.chip}`}
                      >
                        {f.accentLabel}
                      </span>
                    </div>
                    <div
                      className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r md:h-1 ${f.gradient}`}
                      aria-hidden
                    />
                  </div>

                  {/* Conteúdo */}
                  <div
                    className={`flex flex-col justify-center px-6 pb-8 pt-2 md:px-9 md:py-10 lg:px-11 lg:py-12 ${
                      reverse ? "md:order-1" : "md:order-2"
                    }`}
                  >
                    <div className="mb-5 flex items-center gap-4">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${f.chip} transition-transform group-hover:scale-105 md:h-14 md:w-14`}
                      >
                        <Icon className="h-6 w-6 md:h-7 md:w-7" strokeWidth={1.6} />
                      </div>
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="mb-3 text-xl font-bold leading-snug tracking-[-0.01em] text-foreground transition-colors group-hover:text-primary md:text-2xl">
                      {f.titulo}
                    </h3>
                    <p className="mb-6 max-w-prose text-sm font-light leading-[1.6] text-muted-foreground md:text-base">
                      {f.descricao}
                    </p>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                      {t("landing.featuresSection.explore")}
                      <ArrowRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="py-16 md:py-24 scroll-mt-20">
          <div className="relative rounded-[2rem] md:rounded-[2.5rem] border border-border/80 bg-gradient-to-b from-muted/40 via-card to-card p-8 md:p-12 lg:p-16 overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.4]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, hsl(var(--primary) / 0.08) 1px, transparent 0)",
                backgroundSize: "28px 28px",
              }}
              aria-hidden
            />

            <div className="relative text-center mb-14 md:mb-16 max-w-2xl mx-auto space-y-4 animate-slide-up">
              <Badge
                variant="outline"
                className="rounded-full px-4 py-1 font-mono text-[11px] font-normal uppercase tracking-widest border-primary/25 bg-background/80 text-primary"
              >
                {t("landing.howItWorks.badge")}
              </Badge>
              <h2 className="text-3xl font-bold tracking-[-0.01em] md:text-4xl lg:text-[2.5rem]">
                {t("landing.howItWorks.titleBefore")}{" "}
                <span className="text-primary">{t("landing.howItWorks.titleHighlight")}</span>
              </h2>
              <p className="text-base font-light leading-[1.6] text-muted-foreground md:text-lg">
                {t("landing.howItWorks.subtitle")}
              </p>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6 lg:gap-8">
              {/* Ligne de connexion desktop */}
              <div
                className="hidden md:block absolute top-[3.25rem] left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent"
                aria-hidden
              />

              {passos.map((p, i) => (
                <div
                  key={p.numero}
                  className={`relative flex flex-col items-center text-center space-y-4 animate-slide-up stagger-${i + 1}`}
                >
                  <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-background bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-lg shadow-primary/20">
                    <span className="text-lg font-bold tabular-nums">{p.numero}</span>
                  </div>
                  <div className="space-y-2 pt-1 max-w-xs mx-auto">
                    <h3 className="font-semibold text-lg md:text-xl">{p.titulo}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{p.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Modelos de IA — anúncio aos utilizadores */}
        <section id="modelos-ia" className="py-14 md:py-20 scroll-mt-20" aria-labelledby="modelos-ia-heading">
          <div className="relative rounded-[2rem] md:rounded-[2.5rem] border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-8 md:p-12 lg:p-14 overflow-hidden shadow-sm">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
              aria-hidden
            />
            <div className="relative text-center max-w-2xl mx-auto mb-10 md:mb-12 space-y-3">
              <Badge
                variant="outline"
                className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 font-mono text-[11px] font-normal uppercase tracking-widest text-primary"
              >
                {t("landing.models.badge")}
              </Badge>
              <h2 id="modelos-ia-heading" className="text-3xl font-bold tracking-[-0.01em] md:text-4xl">
                {t("landing.models.titleBefore")}{" "}
                <span className="text-primary">{t("landing.models.titleHighlight")}</span>
              </h2>
              <p className="text-base font-light leading-[1.6] text-muted-foreground md:text-lg">
                {t("landing.models.subtitle")}
              </p>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 lg:gap-8">
              {modelosIA.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.nome}
                    className="flex flex-col rounded-2xl border border-border/80 bg-background/80 backdrop-blur-sm p-6 md:p-7 shadow-sm transition-all duration-300 hover:border-primary/25 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                        <Icon className="h-6 w-6" strokeWidth={1.75} />
                      </div>
                      <Badge variant="secondary" className="text-[10px] font-mono uppercase tracking-wider shrink-0">
                        {m.tag}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">{m.uso}</p>
                    <h3 className="text-lg font-bold tracking-tight text-foreground md:text-xl mb-2">{m.nome}</h3>
                    <p className="text-sm font-light leading-[1.6] text-muted-foreground flex-1">{m.descricao}</p>
                  </div>
                );
              })}
            </div>

            <p className="relative mt-8 text-center text-xs text-muted-foreground max-w-xl mx-auto leading-relaxed">
              {t("landing.models.footnote")}
            </p>
          </div>
        </section>

        {/* Planos */}
        <section id="planos" className="py-16 md:py-20 scroll-mt-20">
          <div className="text-center mb-8 animate-slide-up">
            <Badge className="mb-4 bg-primary/10 font-mono text-[11px] font-normal uppercase tracking-widest text-primary border-primary/20">
              {t("landing.plans.badge")}
            </Badge>
            <h2 className="text-3xl font-bold tracking-[-0.01em] md:text-4xl lg:text-[2.5rem]">
              {t("landing.plans.title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg font-light leading-[1.6] text-muted-foreground">
              {t("landing.plans.subtitle")}
            </p>
          </div>

          {/* Toggle mensal/anual */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8 sm:mb-10">
            <span className={`text-sm font-medium ${!anual ? 'text-foreground' : 'text-muted-foreground'}`}>
              {t("landing.plans.monthly")}
            </span>
            <Switch checked={anual} onCheckedChange={setAnual} />
            <span className={`text-sm font-medium ${anual ? 'text-foreground' : 'text-muted-foreground'}`}>
              {t("landing.plans.annual")}
            </span>
            {anual && (
              <Badge variant="secondary" className="text-xs text-green-600 bg-green-500/10 border-green-500/20">
                {t("landing.plans.economyBadge")}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {PLANOS.map((plano) => {
              const Icon = iconesPlano[plano.id as keyof typeof iconesPlano];
              const preco = anual ? plano.precoAnual : plano.preco;
              const precoAnualTotal = plano.precoAnual * 12;
              const recursosTraduzidos = t(`landing.plans.${plano.id}.recursos`, {
                returnObjects: true,
              }) as string[];
              const ctaLabel =
                plano.id === "business"
                  ? t("landing.plans.ctaSales")
                  : plano.destaque
                    ? t("landing.plans.ctaSubscribe", { name: plano.nome })
                    : t("landing.plans.ctaStart");
              return (
                <div
                  key={plano.id}
                  className={`relative rounded-xl border p-6 sm:p-7 flex flex-col animate-slide-up ${
                    plano.destaque
                      ? 'bg-primary text-primary-foreground border-primary shadow-xl md:scale-[1.02]'
                      : 'bg-card border-border'
                  }`}
                >
                  {plano.destaque && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-background text-primary shadow">{t("landing.plans.mostPopular")}</Badge>
                    </div>
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 shrink-0 ${
                    plano.destaque ? 'bg-white/20' : 'bg-primary/10'
                  }`}>
                    <Icon className={`w-5 h-5 ${plano.destaque ? 'text-white' : 'text-primary'}`} />
                  </div>
                  <h3 className="font-bold text-xl">
                    {t("landing.plans.planLabel")} {plano.nome}
                  </h3>
                  <div className="mt-2 mb-4 space-y-1">
                    <div>
                      <span className="text-3xl font-bold">R$ {preco}</span>
                      <span className={`text-sm ${plano.destaque ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {t("landing.plans.perMonth")}
                      </span>
                    </div>
                    {anual && (
                      <p className={`text-xs ${plano.destaque ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {t("landing.plans.billedYear", { total: precoAnualTotal })}
                      </p>
                    )}
                  </div>
                  <div className="mb-4 flex-1 space-y-3">
                    <h4
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider opacity-90",
                        plano.destaque ? "text-primary-foreground/85" : "text-muted-foreground"
                      )}
                    >
                      {t("landing.plans.resourcesTitle")}
                    </h4>
                    <ul className="space-y-2">
                      {recursosTraduzidos.map((r, ri) => (
                        <li key={`${plano.id}-r-${ri}`} className="flex items-start gap-2 text-sm">
                          <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plano.destaque ? 'text-white' : 'text-green-500'}`} />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                    {plano.restricoes && plano.restricoes.length > 0 && (
                      <div className="pt-1">
                        <h4
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-wider opacity-90 mb-2",
                            plano.destaque ? "text-primary-foreground/85" : "text-muted-foreground"
                          )}
                        >
                          {t("landing.plans.restrictionsTitle")}
                        </h4>
                        <ul className="space-y-2">
                          {plano.restricoes.map((r) => (
                            <li key={r} className={`flex items-start gap-2 text-sm ${plano.destaque ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                              <X className={`w-4 h-4 shrink-0 mt-0.5 ${plano.destaque ? 'text-primary-foreground/80' : 'text-amber-500'}`} />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <Button
                    asChild
                    variant={plano.destaque ? 'secondary' : 'default'}
                    className="w-full rounded-full"
                  >
                    <Link to="/registro">{ctaLabel}</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA final */}
        <section className="py-16 mb-8">
          <div className="rounded-[2.5rem] bg-primary p-10 md:p-16 text-center text-primary-foreground animate-scale-in">
            <BrainCircuit className="w-10 h-10 mx-auto mb-4 opacity-80" />
            <p className="font-editorial text-primary-foreground/95 mb-3 max-w-lg mx-auto text-lg italic md:text-xl leading-snug">
              {t("landing.finalCta.quote")}
            </p>
            <h2 className="text-3xl font-bold tracking-[-0.01em] md:text-4xl mb-4">
              {t("landing.finalCta.title")}
            </h2>
            <p className="text-primary-foreground/80 text-lg font-light leading-[1.6] mb-8 max-w-xl mx-auto">
              {t("landing.finalCta.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" variant="secondary" className="rounded-full px-10 hover:scale-105 transition-all gap-2">
                <Link to="/registro">
                  {t("landing.finalCta.primary")}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-10 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/login">{t("landing.finalCta.secondary")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-2 mb-3">
                <img src="/android-chrome-192x192.png" alt="Laurena Studio" className="w-7 h-7 rounded-lg" />
                <span className="font-bagel tracking-wider text-lg">LAURENA</span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("landing.footer.tagline")}
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-sm">{t("landing.footer.product")}</h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#funcionalidades" className="hover:text-primary transition-colors">{t("landing.footer.links.features")}</a></li>
                <li><a href="#planos" className="hover:text-primary transition-colors">{t("landing.footer.links.pricing")}</a></li>
                <li><a href="#como-funciona" className="hover:text-primary transition-colors">{t("landing.footer.links.howItWorks")}</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-sm">{t("landing.footer.platform")}</h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link to="/login" className="hover:text-primary transition-colors">{t("landing.footer.links.login")}</Link></li>
                <li><Link to="/registro" className="hover:text-primary transition-colors">{t("landing.footer.links.register")}</Link></li>
                <li><Link to="/dashboard" className="hover:text-primary transition-colors">{t("landing.footer.links.dashboard")}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-sm">{t("landing.footer.legal")}</h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="/privacidade.html" className="hover:text-primary transition-colors">{t("landing.footer.links.privacy")}</a></li>
                <li><a href="/termos.html" className="hover:text-primary transition-colors">{t("landing.footer.links.terms")}</a></li>
                <li><a href="/termos-ia.html" className="hover:text-primary transition-colors">{t("landing.footer.links.termsAi")}</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>{t("landing.footer.copyright")}</p>
            <p>{t("landing.footer.bottomLine")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
