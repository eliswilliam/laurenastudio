/**
 * Pagamento.tsx
 * Subscription management page — shows the user's REAL plan, usage,
 * and billing data fetched from the FastAPI /billing endpoints.
 *
 * Hardcoded mock data has been completely removed.
 */
import { useState, useEffect } from 'react';
import {
  CreditCard,
  Check,
  Zap,
  Crown,
  Building2,
  Loader2,
  ExternalLink,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/useAuthStore';
import {
  apiCreateCheckout,
  apiCustomerPortal,
  apiBillingStatus,
  type BillingStatusResponse,
} from '@/lib/billingApi';
import type { Plano } from '@/lib/types';

// ── Static plan cards (display only) ────────────────────────────────────────

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
  starter: <Zap className="w-5 h-5" />,
  pro: <Crown className="w-5 h-5" />,
  business: <Building2 className="w-5 h-5" />,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(Math.round((used / limit) * 100), 100);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Pagamento() {
  const [anual, setAnual] = useState(true);
  const [carregando, setCarregando] = useState<string | null>(null);
  const [portalCarregando, setPortalCarregando] = useState(false);

  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);

  const { fetchBillingStatus } = useAuthStore();
  const { toast } = useToast();

  // ── Fetch real billing data ───────────────────────────────────────────────

  const loadBilling = async () => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const data = await apiBillingStatus();
      setBilling(data);
      fetchBillingStatus();
    } catch (err: any) {
      setBillingError(err?.message || 'Erro ao carregar dados de faturamento.');
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'success') {
      toast({
        title: 'Pagamento confirmado!',
        description: 'Sua assinatura foi ativada com sucesso.',
      });
      window.history.replaceState({}, '', '/pagamento');
      loadBilling();
    } else if (status === 'canceled') {
      toast({
        title: 'Pagamento cancelado',
        description: 'Voc\u00ea cancelou o checkout. Nenhuma cobran\u00e7a foi feita.',
        variant: 'destructive',
      });
      window.history.replaceState({}, '', '/pagamento');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────

  const isActive = billing?.is_active ?? false;
  const planName = billing?.subscription?.plan?.name ?? null;
  const planDisplayName = billing?.subscription?.plan?.display_name ?? planName ?? 'Nenhum';
  const nextBillingDate = billing?.subscription?.current_period_end ?? null;

  const postsUsed = billing?.usage?.usage?.posts_used ?? 0;
  const postsLimit = billing?.usage?.limits?.post_limit ?? 0;
  const textUsed = billing?.usage?.usage?.text_used ?? 0;
  const textLimit = billing?.usage?.limits?.text_limit ?? 0;
  const imageUsed = billing?.usage?.usage?.image_used ?? 0;
  const imageLimit = billing?.usage?.limits?.image_limit ?? 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCheckout = async (planoId: string) => {
    if (planoId === planName) return;
    setCarregando(planoId);
    try {
      const { url } = await apiCreateCheckout(
        planoId,
        `${window.location.origin}/pagamento?status=success`,
        `${window.location.origin}/pagamento?status=canceled`,
      );
      window.location.href = url;
    } catch (err: any) {
      console.error('Erro ao criar checkout:', err);
      setCarregando(null);
      toast({
        title: 'Erro no checkout',
        description: err?.message || 'N\u00e3o foi poss\u00edvel iniciar o pagamento.',
        variant: 'destructive',
      });
    }
  };

  const handleManageSubscription = async () => {
    setPortalCarregando(true);
    try {
      const { url } = await apiCustomerPortal();
      window.location.href = url;
    } catch (err: any) {
      console.error('Erro ao abrir portal:', err);
      setPortalCarregando(false);
      toast({
        title: 'Erro',
        description: err?.message || 'N\u00e3o foi poss\u00edvel abrir o portal.',
        variant: 'destructive',
      });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-primary" />
          Plano & Pagamento
        </h1>
        <p className="text-muted-foreground">
          Gerencie sua assinatura e acompanhe seu uso mensal.
        </p>
      </div>

      {/* Status atual */}
      <Card className="rounded-xl border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Plano Atual</CardTitle>
              <CardDescription>
                {billingLoading
                  ? 'Carregando\u2026'
                  : isActive
                    ? `Pr\u00f3xima cobran\u00e7a em ${formatDate(nextBillingDate)}`
                    : 'Nenhuma assinatura ativa'}
              </CardDescription>
            </div>
            {!billingLoading && (
              <Badge
                className={`gap-1 text-sm capitalize ${
                  isActive ? '' : 'bg-destructive/10 text-destructive border-destructive/20'
                }`}
                variant={isActive ? 'default' : 'outline'}
              >
                {planName ? iconesPlano[planName] : <AlertCircle className="w-4 h-4" />}
                {isActive ? planDisplayName : 'Inativo'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {billingLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando dados de uso\u2026
            </div>
          ) : billingError ? (
            <div className="flex items-center gap-2 text-destructive text-sm py-4">
              <AlertCircle className="w-4 h-4" />
              {billingError}
              <Button variant="ghost" size="sm" onClick={loadBilling}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Tentar novamente
              </Button>
            </div>
          ) : isActive ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Posts este m\u00eas</span>
                    <span className="font-medium">
                      {postsUsed}/{postsLimit > 0 ? postsLimit : '\u221e'}
                    </span>
                  </div>
                  <Progress value={pct(postsUsed, postsLimit)} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Gera\u00e7\u00f5es IA (texto)</span>
                    <span className="font-medium">
                      {textUsed}/{textLimit > 0 ? textLimit : '\u221e'}
                    </span>
                  </div>
                  <Progress value={pct(textUsed, textLimit)} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Gera\u00e7\u00f5es IA (imagem)</span>
                    <span className="font-medium">
                      {imageUsed}/{imageLimit > 0 ? imageLimit : '\u221e'}
                    </span>
                  </div>
                  <Progress value={pct(imageUsed, imageLimit)} className="h-2" />
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full sm:w-auto gap-2"
                onClick={handleManageSubscription}
                disabled={portalCarregando}
              >
                {portalCarregando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                Gerenciar assinatura no Stripe
              </Button>
            </>
          ) : (
            <div className="text-sm text-muted-foreground py-2">
              Voc\u00ea n\u00e3o tem um plano ativo. Escolha um plano abaixo para come\u00e7ar.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Toggle mensal/anual */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm font-medium ${!anual ? 'text-foreground' : 'text-muted-foreground'}`}>
          Mensal
        </span>
        <Switch checked={anual} onCheckedChange={setAnual} />
        <span className={`text-sm font-medium ${anual ? 'text-foreground' : 'text-muted-foreground'}`}>
          Anual
        </span>
        {anual && (
          <Badge variant="secondary" className="text-xs text-green-600 bg-green-50">
            Economize at\u00e9 25%
          </Badge>
        )}
      </div>

      {/* Cards de planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {planos.map((plano) => {
          const isAtual = plano.id === planName;
          const preco = anual ? plano.precoAnual : plano.preco;

          return (
            <Card
              key={plano.id}
              className={`rounded-xl relative ${
                plano.destaque ? 'border-primary shadow-lg ring-1 ring-primary/20' : ''
              } ${isAtual ? 'ring-2 ring-green-500/30 border-green-500/40' : ''}`}
            >
              {plano.destaque && !isAtual && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground shadow-md">
                    Mais Popular
                  </Badge>
                </div>
              )}
              {isAtual && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-green-600 text-white shadow-md">
                    Seu Plano
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center ${
                  isAtual
                    ? 'bg-green-600 text-white'
                    : plano.destaque
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {iconesPlano[plano.id]}
                </div>
                <CardTitle className="text-xl">{plano.nome}</CardTitle>
                <div className="mt-2">
                  <span className="text-4xl font-bold">R${preco}</span>
                  <span className="text-muted-foreground text-sm">/m\u00eas</span>
                  {anual && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Cobrado R${preco * 12}/ano
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2.5">
                  {plano.recursos.map((recurso) => (
                    <li key={recurso} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{recurso}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isAtual ? 'outline' : plano.destaque ? 'default' : 'outline'}
                  onClick={() => handleCheckout(plano.id)}
                  disabled={isAtual || carregando === plano.id}
                >
                  {carregando === plano.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {isAtual ? 'Plano Atual' : isActive ? `Trocar para ${plano.nome}` : `Assinar ${plano.nome}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Portal Stripe */}
      {isActive && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">Faturas e Pagamentos</CardTitle>
            <CardDescription>
              Acesse o portal Stripe para visualizar faturas, atualizar forma de pagamento ou cancelar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleManageSubscription}
              disabled={portalCarregando}
            >
              {portalCarregando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              Abrir portal de pagamento
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
