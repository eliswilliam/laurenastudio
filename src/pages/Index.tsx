import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import IntroSection from "@/components/IntroSection";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  CalendarDays,
  BarChart3,
  Megaphone,
  Image,
  Check,
  ArrowRight,
  Zap,
  Crown,
  Building2,
} from "lucide-react";

const funcionalidades = [
  {
    icon: Sparkles,
    titulo: "AI Studio",
    descricao: "Gere textos, imagens e vídeos com IA em segundos. Escolha o tom, a plataforma e a voz da sua marca.",
    href: "/ai-studio",
    cor: "bg-primary/10 text-primary",
  },
  {
    icon: Megaphone,
    titulo: "Marketing AI",
    descricao: "Crie imagens e vídeos publicitários com IA. Anúncios profissionais em poucos minutos.",
    href: "/marketing-ai",
    cor: "bg-blue-500/10 text-blue-500",
  },
  {
    icon: CalendarDays,
    titulo: "Agendador",
    descricao: "Calendim visual para organizar todo seu conteúdo. Agende posts com um clique para qualquer horário.",
    href: "/agendador",
    cor: "bg-green-500/10 text-green-500",
  },
  {
    icon: BarChart3,
    titulo: "Analytics",
    descricao: "Acompanhe impressões, engajamento, cliques e crescimento de seguidores com gráficos detalhados.",
    href: "/analytics",
    cor: "bg-amber-500/10 text-amber-500",
  },
  {
    icon: Megaphone,
    titulo: "Ads Analytics",
    descricao: "Monitore CPC, CPA, ROAS e conversões das suas campanhas no Meta, Google e TikTok.",
    href: "/ads-analytics",
    cor: "bg-pink-500/10 text-pink-500",
  },
  {
    icon: Image,
    titulo: "Biblioteca de Mídia",
    descricao: "Organize todas as suas imagens e vídeos gerados pela IA ou enviados por upload em um único lugar.",
    href: "/midia",
    cor: "bg-violet-500/10 text-violet-500",
  },
];

const passos = [
  {
    numero: "01",
    titulo: "Descreva sua ideia",
    descricao: "Digite um prompt simples e escolha o tom, a plataforma e o estilo visual que deseja.",
  },
  {
    numero: "02",
    titulo: "A IA cria o conteúdo",
    descricao: "Em segundos, o Laurena Studio gera texto, imagem ou vídeo prontos para publicar.",
  },
  {
    numero: "03",
    titulo: "Publique ou agende",
    descricao: "Publique agora nas suas redes ou agende para o melhor horário com um só clique.",
  },
];

const planos = [
  {
    id: "starter",
    icon: Zap,
    nome: "Starter",
    preco: "R$ 49",
    periodo: "/mês",
    descricao: "Perfeito para criadores que estão começando.",
    recursos: ["50 posts por mês", "100 gerações IA", "3 redes sociais", "Analytics básico"],
    destaque: false,
    cta: "Começar",
  },
  {
    id: "pro",
    icon: Crown,
    nome: "Pro",
    preco: "R$ 129",
    periodo: "/mês",
    descricao: "Para profissionais e times de marketing.",
    recursos: ["500 posts por mês", "1.000 gerações IA", "Todas as redes sociais", "Ads Analytics", "Agendamento inteligente"],
    destaque: true,
    cta: "Assinar Pro",
  },
  {
    id: "business",
    icon: Building2,
    nome: "Business",
    preco: "R$ 349",
    periodo: "/mês",
    descricao: "Para agências e empresas de alto volume.",
    recursos: ["Posts ilimitados", "IA ilimitada", "White-label", "API personalizada", "Gerente dedicado"],
    destaque: false,
    cta: "Falar com vendas",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background animate-fade-in">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <HeroSection />

        {/* Stats */}
        <IntroSection />

        {/* Funcionalidades */}
        <section id="funcionalidades" className="py-16 md:py-20 scroll-mt-20">
          <div className="text-center mb-12 animate-slide-up">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Funcionalidades</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Uma plataforma, infinitas possibilidades</h2>
            <p className="text-muted-foreground mt-3 text-lg max-w-2xl mx-auto">
              Tudo o que um criador de conteúdo ou equipe de marketing precisa para crescer online.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {funcionalidades.map((f, i) => {
              const Icon = f.icon;
              return (
                <Link
                  key={f.titulo}
                  to="/login"
                  className={`group block rounded-2xl bg-card border border-border p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-slide-up stagger-${Math.min(i + 1, 6)}`}
                >
                  <div className={`w-11 h-11 rounded-xl ${f.cor} flex items-center justify-center mb-4`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-base mb-2 group-hover:text-primary transition-colors">{f.titulo}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.descricao}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="py-16 md:py-20 scroll-mt-20">
          <div className="rounded-[2.5rem] bg-card border border-border p-8 md:p-14">
            <div className="text-center mb-12 animate-slide-up">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Como funciona</Badge>
              <h2 className="text-3xl md:text-4xl font-bold">Simples como deve ser</h2>
              <p className="text-muted-foreground mt-3 text-lg max-w-xl mx-auto">
                Três passos para transformar uma ideia em conteúdo publicado.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {passos.map((p, i) => (
                <div key={p.numero} className={`text-center space-y-3 animate-slide-up stagger-${i + 1}`}>
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <span className="text-xl font-bold text-primary">{p.numero}</span>
                  </div>
                  {i < passos.length - 1 && (
                    <div className="hidden md:block absolute" />
                  )}
                  <h3 className="font-semibold text-lg">{p.titulo}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.descricao}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Planos */}
        <section id="planos" className="py-16 md:py-20 scroll-mt-20">
          <div className="text-center mb-12 animate-slide-up">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Planos</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Invista no seu crescimento</h2>
            <p className="text-muted-foreground mt-3 text-lg max-w-xl mx-auto">
              Planos flexíveis para cada fase da sua jornada. Cancele quando quiser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {planos.map((plano, i) => {
              const Icon = plano.icon;
              return (
                <div
                  key={plano.id}
                  className={`relative rounded-2xl border p-7 flex flex-col animate-slide-up stagger-${i + 1} ${
                    plano.destaque
                      ? 'bg-primary text-primary-foreground border-primary shadow-xl scale-[1.02]'
                      : 'bg-card border-border'
                  }`}
                >
                  {plano.destaque && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-background text-primary shadow">★ Mais popular</Badge>
                    </div>
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                    plano.destaque ? 'bg-white/20' : 'bg-primary/10'
                  }`}>
                    <Icon className={`w-5 h-5 ${plano.destaque ? 'text-white' : 'text-primary'}`} />
                  </div>
                  <h3 className="font-bold text-xl">{plano.nome}</h3>
                  <p className={`text-sm mt-1 mb-4 ${plano.destaque ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {plano.descricao}
                  </p>
                  <div className="mb-5">
                    <span className="text-3xl font-bold">{plano.preco}</span>
                    <span className={`text-sm ${plano.destaque ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {plano.periodo}
                    </span>
                  </div>
                  <ul className="space-y-2.5 mb-7 flex-1">
                    {plano.recursos.map((r) => (
                      <li key={r} className="flex items-center gap-2 text-sm">
                        <Check className={`w-4 h-4 shrink-0 ${plano.destaque ? 'text-white' : 'text-green-500'}`} />
                        {r}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={plano.destaque ? 'secondary' : 'default'}
                    className="w-full rounded-full"
                  >
                    <Link to="/registro">{plano.cta}</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA final */}
        <section className="py-16 mb-8">
          <div className="rounded-[2.5rem] bg-primary p-10 md:p-16 text-center text-primary-foreground animate-scale-in">
            <Sparkles className="w-10 h-10 mx-auto mb-4 opacity-80" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Pronto para criar conteúdo que converte?</h2>
            <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
              Comece hoje mesmo gratuitamente. Sem cartão de crédito.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" variant="secondary" className="rounded-full px-10 hover:scale-105 transition-all gap-2">
                <Link to="/registro">
                  Criar conta grátis
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-10 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/login">Já tenho uma conta</Link>
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
                A plataforma de IA para criadores de conteúdo e times de marketing.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-sm">Produto</h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#funcionalidades" className="hover:text-primary transition-colors">Funcionalidades</a></li>
                <li><a href="#planos" className="hover:text-primary transition-colors">Planos e Preços</a></li>
                <li><a href="#como-funciona" className="hover:text-primary transition-colors">Como funciona</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-sm">Plataforma</h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link to="/login" className="hover:text-primary transition-colors">Entrar</Link></li>
                <li><Link to="/registro" className="hover:text-primary transition-colors">Criar conta</Link></li>
                <li><Link to="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-sm">Legal</h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="/privacidade.html" className="hover:text-primary transition-colors">Privacidade</a></li>
                <li><a href="/termos.html" className="hover:text-primary transition-colors">Termos Gerais</a></li>
                <li><a href="/termos-ia.html" className="hover:text-primary transition-colors">Termos de IA</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>© 2026 Laurena Studio. Todos os direitos reservados.</p>
            <p>Feito para criadores de conteúdo</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
