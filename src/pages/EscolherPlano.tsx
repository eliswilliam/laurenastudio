/**
 * EscolherPlano.tsx
 * Gate page shown after sign-in when the user has no active subscription.
 * The user MUST pick a plan and pay on Stripe before accessing the dashboard.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Zap,
  Crown,
  Building2,
  Loader2,
  BrainCircuit,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/useAuthStore';
import { apiCreateCheckout } from '@/lib/billingApi';
import { PLANOS } from '@/data/planos';

const iconesPlano: Record<string, React.ReactNode> = {
  starter: <Zap className="w-6 h-6" />,
  pro: <Crown className="w-6 h-6" />,
  business: <Building2 className="w-6 h-6" />,
};

export default function EscolherPlano() {
  const [anual, setAnual] = useState(true);
  const [carregando, setCarregando] = useState<string | null>(null);
  const { usuario, isAutenticado, fetchBillingStatus, temPlanoAtivo, logout } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!isAutenticado) {
      navigate('/login', { replace: true });
    }
  }, [isAutenticado, navigate]);

  useEffect(() => {
    if (temPlanoAtivo) {
      navigate('/dashboard', { replace: true });
    }
  }, [temPlanoAtivo, navigate]);

  const handleCheckout = async (planoId: string) => {
    setCarregando(planoId);
    try {
      const { url } = await apiCreateCheckout(
        planoId,
        `${window.location.origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
        `${window.location.origin}/checkout/sucesso?canceled=true`,
      );
      window.location.href = url;
    } catch (err: unknown) {
      setCarregando(null);
      toast({
        title: 'Erro no checkout',
        description: err instanceof Error ? err.message : 'Não foi possível iniciar o pagamento.',
        variant: 'destructive',
      });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/android-chrome-192x192.png" alt="Laurena Studio" className="w-10 h-10 rounded-xl shrink-0" />
            <span className="font-bagel tracking-wider text-xl truncate">LAURENA</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {usuario && (
              <span className="text-sm text-muted-foreground hidden sm:inline truncate max-w-[180px]">
                {usuario.email}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Title */}
        <div className="text-center mb-8 sm:mb-10 space-y-3">
          <Badge className="inline-flex gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
            <BrainCircuit className="w-4 h-4" />
            Falta pouco
          </Badge>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
            Escolha seu plano para começar
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Para acessar o painel, escolha o plano ideal para você. Cancele a qualquer momento.
          </p>
        </div>

        {/* Toggle mensal/anual */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8 sm:mb-10">
          <span className={`text-sm font-medium ${!anual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Mensal
          </span>
          <Switch checked={anual} onCheckedChange={setAnual} />
          <span className={`text-sm font-medium ${anual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Anual
          </span>
          {anual && (
            <Badge variant="secondary" className="text-xs text-green-600 bg-green-500/10 border-green-500/20">
              Economize 25% no plano anual
            </Badge>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
          {PLANOS.map((plano) => {
            const preco = anual ? plano.precoAnual : plano.preco;
            const precoAnualTotal = plano.precoAnual * 12;

            return (
              <Card
                key={plano.id}
                className={`rounded-xl relative flex flex-col transition-all duration-200 ${
                  plano.destaque
                    ? 'border-primary shadow-lg ring-2 ring-primary/20 md:scale-[1.02]'
                    : 'border-border hover:border-primary/40 hover:shadow-md'
                }`}
              >
                {plano.destaque && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-md px-4 py-1 text-xs font-semibold">
                      Mais popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4 pt-8 px-4 sm:px-6">
                  <div
                    className={`w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center shrink-0 ${
                      plano.destaque ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {iconesPlano[plano.id]}
                  </div>
                  <CardTitle className="text-xl font-bold">
                    Plano {plano.nome}
                  </CardTitle>

                  {/* Preço */}
                  <div className="mt-4 space-y-1">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl sm:text-4xl font-bold">R$ {preco}</span>
                      <span className="text-muted-foreground text-sm">/ mês</span>
                    </div>
                    {anual && (
                      <p className="text-xs text-muted-foreground">
                        Cobrado R$ {precoAnualTotal} / ano
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col px-4 sm:px-6 pb-6 space-y-4">
                  {/* Recursos */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Recursos incluídos
                    </h3>
                    <ul className="space-y-2">
                      {plano.recursos.map((recurso) => (
                        <li key={recurso} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <span>{recurso}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Restrições */}
                  {plano.restricoes && plano.restricoes.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Restrições
                      </h3>
                      <ul className="space-y-2">
                        {plano.restricoes.map((r) => (
                          <li key={r} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <X className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button
                    className="w-full mt-auto"
                    variant={plano.destaque ? 'default' : 'outline'}
                    size="lg"
                    onClick={() => handleCheckout(plano.id)}
                    disabled={carregando !== null}
                  >
                    {carregando === plano.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Assinar {plano.nome}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-xs sm:text-sm text-muted-foreground mt-8">
          Pagamento seguro via Stripe. Cancele quando quiser sem multa.
        </p>
      </main>
    </div>
  );
}
