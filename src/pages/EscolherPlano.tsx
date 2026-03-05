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
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/useAuthStore';
import { apiCreateCheckout } from '@/lib/billingApi';
import type { Plano } from '@/lib/types';

const planos: Plano[] = [
  {
    id: 'starter',
    nome: 'Starter',
    preco: 49,
    precoAnual: 39,
    recursos: [
      '50 posts por mês',
      '100 gerações IA',
      '3 redes sociais',
      '1 membro',
      '5GB armazenamento',
      'Analytics básico',
      'Suporte por e-mail',
    ],
    limites: { postsmes: 50, geracoesIA: 100, membros: 1, armazenamento: '5GB' },
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: 129,
    precoAnual: 99,
    recursos: [
      '500 posts por mês',
      '1.000 gerações IA',
      'Todas as redes sociais',
      '5 membros',
      '50GB armazenamento',
      'Analytics avançado',
      'Ads Analytics',
      'Agendamento inteligente',
      'Suporte prioritário',
    ],
    limites: { postsmes: 500, geracoesIA: 1000, membros: 5, armazenamento: '50GB' },
    destaque: true,
  },
  {
    id: 'business',
    nome: 'Business',
    preco: 349,
    precoAnual: 279,
    recursos: [
      'Posts ilimitados',
      'Gerações IA ilimitadas',
      'Todas as redes sociais',
      'Membros ilimitados',
      '500GB armazenamento',
      'Analytics completo',
      'Ads Analytics premium',
      'API personalizada',
      'White-label',
      'Gerente de conta dedicado',
      'SLA garantido',
    ],
    limites: { postsmes: -1, geracoesIA: -1, membros: -1, armazenamento: '500GB' },
  },
];

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

  // If not authenticated, go to login
  useEffect(() => {
    if (!isAutenticado) {
      navigate('/login', { replace: true });
    }
  }, [isAutenticado, navigate]);

  // Old Stripe redirect handling removed — now handled by /checkout/sucesso page

  // If user already has an active plan, redirect to dashboard
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
    } catch (err: any) {
      console.error('Erro ao criar checkout:', err);
      setCarregando(null);
      toast({
        title: 'Erro no checkout',
        description: err?.message || 'Não foi possível iniciar o pagamento.',
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
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/android-chrome-192x192.png" alt="Laurena Studio" className="w-10 h-10 rounded-xl" />
            <span className="font-bagel tracking-wider text-xl">LAURENA</span>
          </div>
          <div className="flex items-center gap-4">
            {usuario && (
              <span className="text-sm text-muted-foreground hidden sm:block">
                {usuario.email}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="text-center mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-2">
            <Sparkles className="w-4 h-4" />
            Falta pouco!
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">
            Escolha seu plano para começar
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Para acessar o painel, escolha o plano ideal para você.
            Cancele a qualquer momento.
          </p>
        </div>

        {/* Toggle mensal/anual */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm font-medium ${!anual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Mensal
          </span>
          <Switch checked={anual} onCheckedChange={setAnual} />
          <span className={`text-sm font-medium ${anual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Anual
          </span>
          {anual && (
            <Badge variant="secondary" className="text-xs text-green-600 bg-green-50">
              Economize até 25%
            </Badge>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {planos.map((plano) => {
            const preco = anual ? plano.precoAnual : plano.preco;

            return (
              <Card
                key={plano.id}
                className={`rounded-xl relative transition-shadow hover:shadow-lg ${
                  plano.destaque
                    ? 'border-primary shadow-lg ring-2 ring-primary/20 scale-[1.02]'
                    : 'hover:border-primary/40'
                }`}
              >
                {plano.destaque && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-md px-4">
                      Mais Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4 pt-8">
                  <div className={`w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center ${
                    plano.destaque ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {iconesPlano[plano.id]}
                  </div>
                  <CardTitle className="text-xl">{plano.nome}</CardTitle>
                  <div className="mt-3">
                    <span className="text-4xl font-bold">R${preco}</span>
                    <span className="text-muted-foreground text-sm">/mês</span>
                    {anual && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Cobrado R${preco * 12}/ano
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pb-8">
                  <ul className="space-y-2.5">
                    {plano.recursos.map((recurso) => (
                      <li key={recurso} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        <span>{recurso}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full mt-4"
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

        <p className="text-center text-xs text-muted-foreground mt-8">
          Pagamento seguro via Stripe. Cancele quando quiser sem multa.
        </p>
      </div>
    </div>
  );
}
