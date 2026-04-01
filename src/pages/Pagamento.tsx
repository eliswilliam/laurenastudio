/**
 * Pagamento.tsx
 * Subscription management page: user's plan, usage, and billing data.
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
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/useAuthStore';
import {
  apiChangePlan,
  apiCreateCheckout,
  apiCustomerPortal,
  apiBillingStatus,
  type BillingStatusResponse,
} from '@/lib/billingApi';
import { PLANOS, PLAN_DISPLAY_NAMES } from '@/data/planos';
import { useTranslation } from '@/hooks/useTranslation';

const iconesPlano: Record<string, React.ReactNode> = {
  starter: <Zap className="w-5 h-5" />,
  pro: <Crown className="w-5 h-5" />,
  business: <Building2 className="w-5 h-5" />,
};

const planOrder: Record<string, number> = {
  starter: 1,
  pro: 2,
  business: 3,
};

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(Math.round((used / limit) * 100), 100);
}

export default function Pagamento() {
  const { t, i18n } = useTranslation();

  const formatDate = (iso: string | null | undefined): string => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };
  const [anual, setAnual] = useState(true);
  const [carregando, setCarregando] = useState<string | null>(null);
  const [portalCarregando, setPortalCarregando] = useState(false);
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);

  const { fetchBillingStatus } = useAuthStore();
  const { toast } = useToast();

  const loadBilling = async () => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const data = await apiBillingStatus();
      setBilling(data);
      fetchBillingStatus();
    } catch (err: unknown) {
      setBillingError(err instanceof Error ? err.message : t('pages.payment.billingLoadError'));
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'success') {
      toast({
        title: t('pages.payment.toastSuccessTitle'),
        description: t('pages.payment.toastSuccessDesc'),
      });
      window.history.replaceState({}, '', '/pagamento');
      loadBilling();
    } else if (status === 'canceled') {
      toast({
        title: t('pages.payment.toastCanceledTitle'),
        description: t('pages.payment.toastCanceledDesc'),
        variant: 'destructive',
      });
      window.history.replaceState({}, '', '/pagamento');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; toasts need stable t()
  }, []);

  const isActive = billing?.is_active ?? false;
  const planName = billing?.subscription?.plan?.name ?? null;
  const planDisplayName = (planName ? PLAN_DISPLAY_NAMES[planName] : null) ?? billing?.subscription?.plan?.display_name ?? planName ?? t('pages.dashboard.none');
  const currentBillingCycle = billing?.subscription?.billing_cycle ?? null;
  const nextBillingDate = billing?.subscription?.current_period_end ?? null;
  const cancelAtPeriodEnd = Boolean(billing?.subscription?.cancel_at_period_end);
  const nextPlanDisplayName = billing?.subscription?.next_plan_display_name ?? null;
  const nextPlanCycle = billing?.subscription?.next_billing_cycle ?? null;

  const textUsed = billing?.usage?.usage?.text_used ?? 0;
  const textLimit = billing?.usage?.limits?.text_limit ?? 0;
  const imageUsed = billing?.usage?.usage?.image_used ?? 0;
  const imageLimit = billing?.usage?.limits?.image_limit ?? 0;
  const videoUsed = billing?.usage?.usage?.video_used ?? 0;
  const videoLimit = billing?.usage?.limits?.video_limit ?? 0;
  const audioUsed = billing?.usage?.usage?.audio_used ?? 0;
  const audioLimit = billing?.usage?.limits?.audio_limit ?? 0;
  const sitePubUsed = billing?.usage?.usage?.site_publishes_used ?? 0;
  const sitePubLimit = billing?.usage?.limits?.site_publish_limit ?? 0;

  const handleCheckout = async (planoId: string) => {
    const targetCycle = anual ? 'annual' : 'monthly';
    const samePlanAndCycle = planoId === planName && currentBillingCycle === targetCycle;
    if (samePlanAndCycle) return;

    if (isActive && currentBillingCycle === 'annual' && targetCycle === 'monthly') {
      toast({
        title: 'Mudanca nao permitida',
        description:
          'Voce esta em um plano anual. Aguarde o fim do ciclo anual, cancele a assinatura e depois escolha um plano mensal.',
        variant: 'destructive',
      });
      return;
    }

    setCarregando(planoId);
    try {
      if (isActive && planName) {
        const currentRank = planOrder[planName] ?? 0;
        const targetRank = planOrder[planoId] ?? 0;
        const isUpgrade = targetRank > currentRank;
        const isMonthlyToAnnual = currentBillingCycle === 'monthly' && targetCycle === 'annual';

        if (isUpgrade || isMonthlyToAnnual) {
          const confirmed = window.confirm(
            'Este upgrade inicia imediatamente um novo ciclo sem prorrata. ' +
            'Você perde o tempo restante do plano atual. ' +
            'Recomendamos aguardar o fim do ciclo atual. Deseja continuar?'
          );
          if (!confirmed) {
            setCarregando(null);
            return;
          }
        }

        const result = await apiChangePlan(planoId, targetCycle);
        if (result.action === 'upgrade_checkout_required' && result.checkout_url) {
          window.location.href = result.checkout_url;
          return;
        }

        toast({
          title: isUpgrade ? 'Alteração iniciada' : 'Alteração agendada',
          description: result.message,
        });
        await loadBilling();
        setCarregando(null);
        return;
      }

      const { url } = await apiCreateCheckout(
        planoId,
        targetCycle,
        `${window.location.origin}/pagamento?status=success`,
        `${window.location.origin}/pagamento?status=canceled`,
      );
      window.location.href = url;
    } catch (err: unknown) {
      setCarregando(null);
      toast({
        title: t('pages.payment.checkoutErrorTitle'),
        description: err instanceof Error ? err.message : t('pages.payment.checkoutErrorDesc'),
        variant: 'destructive',
      });
    }
  };

  const handleManageSubscription = async () => {
    setPortalCarregando(true);
    try {
      const { url } = await apiCustomerPortal();
      window.location.href = url;
    } catch (err: unknown) {
      setPortalCarregando(false);
      toast({
        title: t('pages.payment.portalErrorTitle'),
        description: err instanceof Error ? err.message : t('pages.payment.portalErrorDesc'),
        variant: 'destructive',
      });
    }
  };

  const handleCycleToggle = (checked: boolean) => {
    if (isActive && currentBillingCycle === 'annual' && !checked) {
      toast({
        title: 'Plano anual ativo',
        description:
          'Para voltar ao mensal, aguarde o fim do plano anual e cancele a assinatura atual.',
        variant: 'destructive',
      });
      return;
    }
    setAnual(checked);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-primary" />
          {t('pages.payment.title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('pages.payment.subtitle')}
        </p>
      </div>

      {/* Status atual */}
      <Card className="rounded-xl border-primary/20">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">{t('pages.payment.currentPlan')}</CardTitle>
              <CardDescription>
                {billingLoading
                  ? t('pages.payment.loading')
                  : isActive
                    ? cancelAtPeriodEnd
                      ? `Ativo até ${formatDate(nextBillingDate)}`
                      : t('pages.payment.nextChargeOn', { date: formatDate(nextBillingDate) })
                    : t('pages.payment.noSubscription')}
              </CardDescription>
              {!billingLoading && isActive && nextPlanDisplayName && (
                <p className="text-xs text-amber-600 mt-1">
                  Próximo plano agendado: {nextPlanDisplayName}
                  {nextPlanCycle === 'annual' ? ' (anual)' : ' (mensal)'} em {formatDate(nextBillingDate)}
                </p>
              )}
            </div>
            {!billingLoading && (
              <Badge
                className={`gap-1 text-sm capitalize shrink-0 ${
                  isActive ? '' : 'bg-destructive/10 text-destructive border-destructive/20'
                }`}
                variant={isActive ? 'default' : 'outline'}
              >
                {planName ? iconesPlano[planName] : <AlertCircle className="w-4 h-4" />}
                {isActive ? planDisplayName : t('common.inactive')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {billingLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('pages.payment.loadingUsage')}
            </div>
          ) : billingError ? (
            <div className="flex flex-wrap items-center gap-2 text-destructive text-sm py-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {billingError}
              <Button variant="ghost" size="sm" onClick={loadBilling}>
                <RefreshCw className="w-4 h-4 mr-1" />
                {t('common.retry')}
              </Button>
            </div>
          ) : isActive ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('pages.payment.usageText')}</span>
                    <span className="font-medium">
                      {textUsed} / {textLimit > 0 ? textLimit : '\u221e'}
                    </span>
                  </div>
                  <Progress value={pct(textUsed, textLimit)} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('pages.payment.usageImage')}</span>
                    <span className="font-medium">
                      {imageUsed} / {imageLimit > 0 ? imageLimit : '\u221e'}
                    </span>
                  </div>
                  <Progress value={pct(imageUsed, imageLimit)} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('pages.payment.usageVideo')}</span>
                    <span className="font-medium">
                      {videoUsed} / {videoLimit > 0 ? videoLimit : '\u221e'}
                    </span>
                  </div>
                  <Progress value={pct(videoUsed, videoLimit)} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('pages.payment.usageAudio')}</span>
                    <span className="font-medium">
                      {audioUsed} / {audioLimit > 0 ? audioLimit : '\u221e'}
                    </span>
                  </div>
                  <Progress value={pct(audioUsed, audioLimit)} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('pages.payment.usageSite')}</span>
                    <span className="font-medium">
                      {sitePubUsed} / {sitePubLimit > 0 ? sitePubLimit : '\u221e'}
                    </span>
                  </div>
                  <Progress value={pct(sitePubUsed, sitePubLimit)} className="h-2" />
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
                {t('pages.payment.manageStripe')}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              {t('pages.payment.noPlanHint')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Toggle mensal/anual */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className={`text-sm font-medium ${!anual ? 'text-foreground' : 'text-muted-foreground'}`}>
          {t('landing.plans.monthly')}
        </span>
        <Switch checked={anual} onCheckedChange={handleCycleToggle} />
        <span className={`text-sm font-medium ${anual ? 'text-foreground' : 'text-muted-foreground'}`}>
          {t('landing.plans.annual')}
        </span>
        {anual && (
          <Badge variant="secondary" className="text-xs text-green-600 bg-green-500/10 border-green-500/20">
            {t('landing.plans.economyBadge')}
          </Badge>
        )}
      </div>

      {/* Cards de planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {PLANOS.map((plano) => {
          const targetCycle = anual ? 'annual' : 'monthly';
          const isAtual = plano.id === planName;
          const isSamePlanAndCycle = isAtual && currentBillingCycle === targetCycle;
          const isDowngrade =
            Boolean(isActive && planName) && (planOrder[plano.id] ?? 0) < (planOrder[planName ?? ''] ?? 0);
          const preco = anual ? plano.precoAnual : plano.preco;
          const precoAnualTotal = plano.precoAnual * 12;
          const recursosTraduzidos = t(`landing.plans.${plano.id}.recursos`, {
            returnObjects: true,
          }) as string[];

          return (
            <Card
              key={plano.id}
              className={`rounded-xl relative flex flex-col transition-all duration-200 ${
                plano.destaque ? 'border-primary shadow-lg ring-1 ring-primary/20' : ''
              } ${isSamePlanAndCycle ? 'ring-2 ring-green-500/30 border-green-500/40' : ''}`}
            >
              {plano.destaque && !isSamePlanAndCycle && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground shadow-md text-xs font-semibold">
                    {t('landing.plans.mostPopular')}
                  </Badge>
                </div>
              )}
              {isSamePlanAndCycle && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-green-600 text-white shadow-md text-xs font-semibold">
                    {t('pages.payment.yourPlan')}
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4 pt-8 px-4 sm:px-6">
                <div
                  className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center shrink-0 ${
                    isSamePlanAndCycle
                      ? 'bg-green-600 text-white'
                      : plano.destaque
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {iconesPlano[plano.id]}
                </div>
                <CardTitle className="text-xl font-bold">
                  {t('landing.plans.planLabel')} {plano.nome}
                </CardTitle>
                <div className="mt-2 space-y-1">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold">R$ {preco}</span>
                    <span className="text-muted-foreground text-sm">{t('landing.plans.perMonth')}</span>
                  </div>
                  {anual && (
                    <p className="text-xs text-muted-foreground">
                      {t('landing.plans.billedYear', { total: precoAnualTotal })}
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col px-4 sm:px-6 pb-6 space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {t('landing.plans.resourcesTitle')}
                  </h3>
                  <ul className="space-y-2">
                    {recursosTraduzidos.map((recurso, ri) => (
                      <li key={`${plano.id}-r-${ri}`} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        <span>{recurso}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {plano.restricoes && plano.restricoes.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {t('landing.plans.restrictionsTitle')}
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
                  variant={isSamePlanAndCycle ? 'outline' : plano.destaque ? 'default' : 'outline'}
                  onClick={() => handleCheckout(plano.id)}
                  disabled={isSamePlanAndCycle || carregando === plano.id}
                >
                  {carregando === plano.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {isSamePlanAndCycle
                    ? t('pages.payment.currentPlanBtn')
                    : isActive
                      ? isDowngrade
                        ? `Agendar ${plano.nome}`
                        : t('pages.payment.changeTo', { name: plano.nome })
                      : t('pages.payment.subscribe', { name: plano.nome })}
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
            <CardTitle className="text-base">{t('pages.payment.invoicesTitle')}</CardTitle>
            <CardDescription>
              {t('pages.payment.invoicesDesc')}
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
              {t('pages.payment.openPortal')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
