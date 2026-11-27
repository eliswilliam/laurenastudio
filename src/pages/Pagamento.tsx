/**
 * Pagamento.tsx — Subscription management
 *
 * Rules:
 *  - Only show upgradeable plans (plans with rank > current plan)
 *  - Annual → monthly switch is impossible (hidden toggle when annual)
 *  - cancel_at_period_end → prominent warning banner
 *  - status=canceled after period end → redirect to /escolher-plano
 */
import { type ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  AlertTriangle,
  ArrowUp,
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
  apiVerifySession,
  type BillingStatusResponse,
} from '@/lib/billingApi';
import { PLANOS, PLAN_DISPLAY_NAMES } from '@/data/planos';
import { useTranslation } from '@/hooks/useTranslation';
import { formatApiError } from '@/lib/api';

const iconesPlano: Record<string, ReactNode> = {
  starter:  <Zap className="w-5 h-5" />,
  pro:      <Crown className="w-5 h-5" />,
  business: <Building2 className="w-5 h-5" />,
};

const planOrder: Record<string, number> = {
  starter:  1,
  pro:      2,
  business: 3,
};

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(Math.round((used / limit) * 100), 100);
}

/**
 * SECURITY: Escape user/API-sourced strings before injecting into dangerouslySetInnerHTML.
 * Plan names and display names come from the billing API (database / Stripe).
 * If they ever contain HTML characters, they could cause XSS.
 */
function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export default function Pagamento() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat(i18n.language || 'pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (iso: string | null | undefined): string => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString(i18n.language, {
      day:   '2-digit',
      month: 'long',
      year:  'numeric',
    });
  };

  const [anual, setAnual]                   = useState(true);
  const [carregando, setCarregando]         = useState<string | null>(null);
  const [portalCarregando, setPortalCarregando] = useState(false);
  const [billing, setBilling]               = useState<BillingStatusResponse | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError]     = useState<string | null>(null);

  const { fetchBillingStatus } = useAuthStore();
  const { toast } = useToast();

  const loadBilling = async () => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const data = await apiBillingStatus();
      setBilling(data);
      fetchBillingStatus();

      // If subscription is fully canceled (period ended), send to plan selector
      if (!data.is_active && data.subscription?.plan?.name) {
        navigate('/escolher-plano');
      }
    } catch (err: unknown) {
      setBillingError(formatApiError(err));
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => { loadBilling(); }, []);

  // Handle Stripe redirect callbacks
  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      if (status === 'success') {
        const sessionId = params.get('session_id');
        if (sessionId) {
          try {
            const verification = await apiVerifySession(sessionId);
            if (verification.status === 'active') {
              toast({ title: t('pages.payment.toastSuccessTitle'), description: t('pages.payment.toastSuccessDesc') });
            } else if (verification.status === 'pending') {
              toast({ title: t('pages.payment.pendingPaymentTitle'), description: verification.message });
            } else {
              toast({ title: t('pages.payment.checkoutErrorTitle'), description: verification.message, variant: 'destructive' });
            }
          } catch {
            toast({ title: t('pages.payment.toastSuccessTitle'), description: t('pages.payment.toastSuccessDesc') });
          }
        } else {
          toast({ title: t('pages.payment.toastSuccessTitle'), description: t('pages.payment.toastSuccessDesc') });
        }
        window.history.replaceState({}, '', '/pagamento');
        await loadBilling();
      } else if (status === 'canceled') {
        toast({ title: t('pages.payment.toastCanceledTitle'), description: t('pages.payment.toastCanceledDesc'), variant: 'destructive' });
        window.history.replaceState({}, '', '/pagamento');
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived state
  const isActive            = billing?.is_active ?? false;
  const planName            = billing?.subscription?.plan?.name ?? null;
  const planDisplayName     = (planName ? PLAN_DISPLAY_NAMES[planName] : null)
                              ?? billing?.subscription?.plan?.display_name
                              ?? planName
                              ?? t('pages.dashboard.none');
  const currentBillingCycle = billing?.subscription?.billing_cycle ?? null;
  const nextBillingDate     = billing?.subscription?.current_period_end ?? null;
  const cancelAtPeriodEnd   = Boolean(billing?.subscription?.cancel_at_period_end);
  const nextPlanDisplayName = billing?.subscription?.next_plan_display_name ?? null;
  const nextPlanCycle       = billing?.subscription?.next_billing_cycle ?? null;
  const isAnnual            = currentBillingCycle === 'annual';

  const textUsed    = billing?.usage?.usage?.text_used ?? 0;
  const textLimit   = billing?.usage?.limits?.text_limit ?? 0;
  const imageUsed   = billing?.usage?.usage?.image_used ?? 0;
  const imageLimit  = billing?.usage?.limits?.image_limit ?? 0;
  const videoUsed   = billing?.usage?.usage?.video_used ?? 0;
  const videoLimit  = billing?.usage?.limits?.video_limit ?? 0;
  const audioUsed   = billing?.usage?.usage?.audio_used ?? 0;
  const audioLimit  = billing?.usage?.limits?.audio_limit ?? 0;
  const sitePubUsed = billing?.usage?.usage?.site_publishes_used ?? 0;
  const sitePubLimit = billing?.usage?.limits?.site_publish_limit ?? 0;

  const currentRank = planOrder[planName ?? ''] ?? 0;

  // Plans the user can upgrade to (strictly higher rank only)
  // If on annual, only show annual upgrade options (no annual→monthly)
  const upgradePlans = PLANOS.filter((p) => {
    const rank = planOrder[p.id] ?? 0;
    return rank > currentRank;
  });

  // Sync toggle: if user is already annual, lock to annual
  useEffect(() => {
    if (isAnnual) setAnual(true);
  }, [isAnnual]);

  const handleCheckout = async (planoId: string) => {
    const targetCycle = anual ? 'annual' : 'monthly';
    setCarregando(planoId);
    try {
      if (isActive && planName) {
        const confirmed = window.confirm(t('pages.payment.upgradeConfirm'));
        if (!confirmed) { setCarregando(null); return; }

        const result = await apiChangePlan(planoId, targetCycle);
        if (result.action === 'upgrade_checkout_required' && result.checkout_url) {
          window.location.href = result.checkout_url;
          return;
        }
        toast({ title: t('pages.payment.upgradeStarted'), description: result.message });
        await loadBilling();
        setCarregando(null);
        return;
      }

      const { url } = await apiCreateCheckout(
        planoId,
        targetCycle,
        `${window.location.origin}/pagamento?status=success&session_id={CHECKOUT_SESSION_ID}`,
        `${window.location.origin}/pagamento?status=canceled`,
      );
      window.location.href = url;
    } catch (err: unknown) {
      setCarregando(null);
      toast({
        title: t('pages.payment.checkoutErrorTitle'),
        description: formatApiError(err),
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
        description: formatApiError(err),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-primary" />
          {t('pages.payment.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('pages.payment.subtitle')}</p>
      </div>

      {/* ── Cancellation warning banner ── */}
      {!billingLoading && isActive && cancelAtPeriodEnd && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">{t('pages.payment.canceledBannerTitle')}</p>
            <p className="mt-0.5"
              dangerouslySetInnerHTML={{ __html: t('pages.payment.canceledBannerBody', { date: escapeHtml(formatDate(nextBillingDate)) }) }}
            />
          </div>
        </div>
      )}

      {/* ── Current plan status card ── */}
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
                      ? t('pages.payment.activeUntil', { date: formatDate(nextBillingDate) })
                      : t('pages.payment.nextChargeOn', { date: formatDate(nextBillingDate) })
                    : t('pages.payment.noSubscription')}
              </CardDescription>
              {!billingLoading && isActive && nextPlanDisplayName && !cancelAtPeriodEnd && (
                <p className="text-xs text-amber-600 mt-1"
                  dangerouslySetInnerHTML={{ __html: t('pages.payment.nextScheduledPlan', {
                    name: escapeHtml(nextPlanDisplayName),
                    cycle: escapeHtml(nextPlanCycle === 'annual' ? t('pages.payment.cycleAnnual') : t('pages.payment.cycleMonthly')),
                    date: escapeHtml(formatDate(nextBillingDate)),
                  }) }}
                />
              )}
              {!billingLoading && isActive && isAnnual && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('pages.payment.annualRenewal')}
                </p>
              )}
            </div>
            {!billingLoading && (
              <Badge
                className={`gap-1 text-sm capitalize shrink-0 ${
                  cancelAtPeriodEnd
                    ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                    : isActive
                      ? ''
                      : 'bg-destructive/10 text-destructive border-destructive/20'
                }`}
                variant={isActive && !cancelAtPeriodEnd ? 'default' : 'outline'}
              >
                {planName ? iconesPlano[planName] : <AlertCircle className="w-4 h-4" />}
                {isActive
                  ? cancelAtPeriodEnd
                    ? t('pages.payment.badgeCanceled', { plan: planDisplayName })
                    : planDisplayName
                  : t('common.inactive')}
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
                {[
                  { label: t('pages.payment.usageText'),  used: textUsed,   limit: textLimit },
                  { label: t('pages.payment.usageImage'), used: imageUsed,  limit: imageLimit },
                  { label: t('pages.payment.usageVideo'), used: videoUsed,  limit: videoLimit },
                  { label: t('pages.payment.usageAudio'), used: audioUsed,  limit: audioLimit },
                  { label: t('pages.payment.usageSite'),  used: sitePubUsed, limit: sitePubLimit },
                ].map(({ label, used, limit }) => (
                  <div key={label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">
                        {used} / {limit > 0 ? limit : '∞'}
                      </span>
                    </div>
                    <Progress value={pct(used, limit)} className="h-2" />
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full sm:w-auto gap-2"
                onClick={handleManageSubscription}
                disabled={portalCarregando}
              >
                {portalCarregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                {t('pages.payment.manageStripe')}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-2">{t('pages.payment.noPlanHint')}</p>
          )}
        </CardContent>
      </Card>

      {/* ── Upgrade section — only shown when upgrades are available ── */}
      {!billingLoading && (isActive ? upgradePlans.length > 0 : true) && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ArrowUp className="w-5 h-5 text-primary" />
                {isActive ? t('pages.payment.upgradeOptionsTitle') : t('pages.payment.choosePlan')}
              </h2>
              {isActive && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t('pages.payment.upgradeOptionsSubtitle', { plan: planDisplayName })}
                </p>
              )}
            </div>

            {/* Cycle toggle — hidden when already annual (annual→monthly not allowed) */}
            {!isAnnual && (
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${!anual ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {t('landing.plans.monthly')}
                </span>
                <Switch checked={anual} onCheckedChange={setAnual} />
                <span className={`text-sm font-medium ${anual ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {t('landing.plans.annual')}
                </span>
                {anual && (
                  <Badge variant="secondary" className="text-xs text-green-600 bg-green-500/10 border-green-500/20">
                    {t('landing.plans.economyBadge')}
                  </Badge>
                )}
              </div>
            )}
            {isAnnual && (
              <Badge variant="secondary" className="text-xs text-green-600 bg-green-500/10 border-green-500/20">
                {t('landing.plans.annual')} — {t('landing.plans.economyBadge')}
              </Badge>
            )}
          </div>

          <div className={`grid gap-4 sm:gap-6 ${
            (isActive ? upgradePlans : PLANOS).length === 1
              ? 'grid-cols-1 max-w-sm'
              : (isActive ? upgradePlans : PLANOS).length === 2
                ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl'
                : 'grid-cols-1 md:grid-cols-3'
          }`}>
            {(isActive ? upgradePlans : PLANOS).map((plano) => {
              const targetCycle   = anual ? 'annual' : 'monthly';
              const isAtual       = plano.id === planName;
              const isSameCycle   = isAtual && currentBillingCycle === targetCycle;
              const preco         = anual ? plano.precoAnual : plano.preco;
              const precoAnualTotal = plano.precoAnual * 12;
              const recursosTraduzidos = t(`landing.plans.${plano.id}.recursos`, {
                returnObjects: true,
              }) as string[];

              return (
                <Card
                  key={plano.id}
                  className={`rounded-xl relative flex flex-col transition-all duration-200 ${
                    plano.destaque ? 'border-primary shadow-lg ring-1 ring-primary/20' : ''
                  } ${isSameCycle ? 'ring-2 ring-green-500/30 border-green-500/40' : ''}`}
                >
                  {plano.destaque && !isSameCycle && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground shadow-md text-xs font-semibold">
                        {t('landing.plans.mostPopular')}
                      </Badge>
                    </div>
                  )}
                  {isSameCycle && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-green-600 text-white shadow-md text-xs font-semibold">
                        {t('pages.payment.yourPlan')}
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-4 pt-8 px-4 sm:px-6">
                    <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center shrink-0 ${
                      isSameCycle ? 'bg-green-600 text-white' : plano.destaque ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {iconesPlano[plano.id]}
                    </div>
                    <CardTitle className="text-xl font-bold">
                      {t('landing.plans.planLabel')} {plano.nome}
                    </CardTitle>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-3xl font-bold">{formatCurrency(preco)}</span>
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
                    <ul className="space-y-2">
                      {recursosTraduzidos.map((recurso, ri) => (
                        <li key={`${plano.id}-r-${ri}`} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <span>{recurso}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full mt-auto"
                      variant={isSameCycle ? 'outline' : plano.destaque ? 'default' : 'outline'}
                      onClick={() => void handleCheckout(plano.id)}
                      disabled={isSameCycle || carregando === plano.id}
                    >
                      {carregando === plano.id && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      {isSameCycle
                        ? t('pages.payment.currentPlanBtn')
                        : isActive
                          ? t('pages.payment.upgradeBtn', { name: plano.nome })
                          : t('pages.payment.subscribe', { name: plano.nome })}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Reached top plan ── */}
      {!billingLoading && isActive && upgradePlans.length === 0 && !cancelAtPeriodEnd && (
        <div className="flex items-center gap-3 rounded-xl border border-green-400/30 bg-green-50 dark:bg-green-950/20 px-4 py-3 text-green-800 dark:text-green-300">
          <Check className="w-5 h-5 shrink-0" />
          <p className="text-sm"
            dangerouslySetInnerHTML={{ __html: t('pages.payment.topPlanMessage', { plan: escapeHtml(planDisplayName) }) }}
          />
        </div>
      )}

      {/* ── Stripe portal / invoices ── */}
      {isActive && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">{t('pages.payment.invoicesTitle')}</CardTitle>
            <CardDescription>{t('pages.payment.invoicesDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleManageSubscription}
              disabled={portalCarregando}
            >
              {portalCarregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              {t('pages.payment.openPortal')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
