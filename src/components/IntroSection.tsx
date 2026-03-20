import { Megaphone, Layers, Globe2, Sparkles } from "lucide-react";

const pillars = [
  {
    icon: Megaphone,
    title: "Campanhas",
    subtitle: "Imagens e vídeos para anúncios",
    iconBg: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  },
  {
    icon: Layers,
    title: "Conteúdo",
    subtitle: "Textos, imagens, vídeo",
    iconBg: "bg-primary/12 text-primary",
  },
  {
    icon: Globe2,
    title: "Sites",
    subtitle: "Sem programar",
    iconBg: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  },
  {
    icon: Sparkles,
    title: "IA",
    subtitle: "Gemini e Veo",
    iconBg: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  },
];

const IntroSection = () => {
  return (
    <section className="relative py-10 md:py-16 lg:py-20 animate-fade-in">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
        aria-hidden
      />

      <div className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm md:rounded-[2.25rem]">
        {/* bande décorative */}
        <div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-amber-500/60 opacity-90"
          aria-hidden
        />

        <div className="relative grid gap-10 p-6 sm:p-8 md:gap-12 md:p-10 lg:grid-cols-[1fr_minmax(0,1fr)] lg:items-center lg:gap-14 lg:p-12">
          {/* Coluna texto + pilares */}
          <div className="relative z-[1] flex flex-col">
            <h2 className="text-2xl font-bold leading-[1.2] tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-[2.35rem]">
              Da ideia ao resultado,{" "}
              <span className="text-primary">sem atrito</span>
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg">
              Crie campanhas completas com imagens, vídeos e textos gerados por IA, tudo pensado para anúncios que convertem. Faça o deploy do seu site na web em poucos minutos, sem escrever uma linha de código.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-10">
              {pillars.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="group flex gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4 transition-all hover:border-primary/25 hover:bg-muted/50 hover:shadow-sm"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground leading-snug sm:text-[13px]">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coluna imagem (apenas a1) */}
          <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:flex lg:max-w-none lg:justify-end">
            <div className="relative w-full overflow-hidden rounded-2xl border border-border/60 shadow-xl shadow-black/10 ring-1 ring-black/5 lg:max-w-md xl:max-w-lg">
              <img
                src="/a1.jpeg"
                alt=""
                className="aspect-[4/5] w-full object-cover sm:aspect-[3/4] lg:aspect-[3/4]"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div
              className="pointer-events-none absolute -right-8 top-1/2 -z-10 hidden h-40 w-40 -translate-y-1/2 rounded-full bg-primary/15 blur-3xl lg:block"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default IntroSection;
