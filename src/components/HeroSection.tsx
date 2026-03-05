import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, Play } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative rounded-[2.5rem] overflow-hidden bg-card my-8 md:my-12 animate-fade-in border border-border">
      {/* Fundo decorativo */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(16,53%,50%) 1px, transparent 0)', backgroundSize: '32px 32px' }}
      />

      <div className="relative grid md:grid-cols-2 gap-0">
        {/* Lado esquerdo — Conteúdo */}
        <div className="flex flex-col justify-center space-y-6 p-8 md:p-12 lg:p-16">
          <Badge className="w-fit gap-1.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
            <Sparkles className="w-3.5 h-3.5" />
            Plataforma com IA
          </Badge>

          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight animate-slide-down">
              Crie conteúdo{" "}
              <span className="text-primary">incrível</span>{" "}
              com Inteligência Artificial
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl leading-relaxed max-w-lg animate-slide-up stagger-1">
              Gere posts, imagens e vídeos com IA, agende em todas as redes sociais e acompanhe seus resultados — tudo em um só lugar.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2 animate-slide-up stagger-2">
            <Button asChild size="lg" className="rounded-full px-8 hover:scale-105 transition-all gap-2">
              <Link to="/registro">
                Começar gratuitamente
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="rounded-full gap-2 text-muted-foreground hover:text-foreground">
              <Link to="/login">
                <Play className="w-4 h-4 fill-current" />
                Entrar na plataforma
              </Link>
            </Button>
          </div>

          {/* Prova social */}
          <div className="flex items-center gap-4 pt-2 animate-slide-up stagger-3">
            <div className="flex -space-x-2">
              {['C', 'M', 'A', 'R'].map((l, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-bold text-primary">
                  {l}
                </div>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">+10.000</span> criadores já usam
            </div>
          </div>
        </div>

        {/* Lado direito — Mockup do app */}
        <div className="relative flex items-center justify-center p-6 md:p-10 bg-muted/40 min-h-[320px] md:min-h-[480px]">
          {/* Card principal */}
          <div className="w-full max-w-sm bg-background rounded-2xl border border-border shadow-xl overflow-hidden animate-scale-in">
            <div className="bg-sidebar px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
              </div>
              <span className="text-[11px] text-sidebar-foreground/50 mx-auto">AI Studio — Laurena Studio</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-muted rounded-xl p-3 text-xs text-muted-foreground leading-relaxed">
                “Crie um post inspirador sobre produtividade para LinkedIn com tom profissional...”
              </div>
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Sparkles className="w-3.5 h-3.5" />
                  Conteúdo gerado
                </div>
                <p className="text-xs leading-relaxed">
                  A produtividade não é sobre fazer mais — é sobre fazer o que importa.
                  Três hábitos que transformaram minha rotina de trabalho...
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Engajamento', valor: '+48%' },
                  { label: 'Alcance', valor: '12.4K' },
                  { label: 'Posts', valor: '342' },
                ].map((m) => (
                  <div key={m.label} className="bg-muted rounded-lg p-2 text-center">
                    <p className="text-xs font-bold text-primary">{m.valor}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Badge flutuante */}
          <div className="absolute bottom-5 right-5 bg-background rounded-xl border border-border shadow-lg px-3 py-2 flex items-center gap-2 animate-slide-up stagger-4">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium">Post agendado</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
