/**
 * Dashboard.tsx
 * Maindashboard: REAL account info, subscription plan,
 * and usage data fetched from the FastAPI /billing endpoints.
 */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Music,
  BrainCircuit,
  ImageIcon,
  Video,
  CreditCard,
  Crown,
  Zap,
  Building2,
  TrendingUp,
  CalendarDays,
  ArrowRight,
  Loader2,
  Megaphone,
  BarChart3,
  LayoutTemplate,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAuthStore } from '@/store/useAuthStore';
import { PLAN_DISPLAY_NAMES } from '@/data/planos';
import { useTranslation } from '@/hooks/useTranslation';

const planIcons: Record<string, React.ReactNode> = {
  starter: <Zap className="w-5 h-5" />,
  pro: <Crown className="w-5 h-5" />,
  business: <Building2 className="w-5 h-5" />,
};

const planColors: Record<string, string> = {
  starter: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  pro: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  business: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
};

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(Math.round((used / limit) * 100), 100);
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { usuario, planoNome, billingStatus, fetchBillingStatus } = useAuthStore();
  const [loading, setLoading] = useState(!billingStatus);

  const formatDate = (iso: string | null | undefined): string => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  useEffect(() => {
    fetchBillingStatus().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sub = billingStatus?.subscription ?? null;
  const plan = sub?.plan ?? null;
  const usage = billingStatus?.usage ?? null;
  const currentPrice = sub?.current_price_brl ?? plan?.price_brl ?? null;
  const isAnnualBilling = sub?.billing_cycle === 'annual';
  const cancelAtPeriodEnd = Boolean(sub?.cancel_at_period_end);
  const nextPlanDisplay = sub?.next_plan_display_name ?? null;
  const nextPlanCycle = sub?.next_billing_cycle ?? null;

  const audioUsed = usage?.usage?.audio_used ?? 0;
  const audioLimit = usage?.limits?.audio_limit ?? 0;
  const textUsed = usage?.usage?.text_used ?? 0;
  const textLimit = usage?.limits?.text_limit ?? 0;
  const imageUsed = usage?.usage?.image_used ?? 0;
  const imageLimit = usage?.limits?.image_limit ?? 0;
  const videoUsed = usage?.usage?.video_used ?? 0;
  const videoLimit = usage?.limits?.video_limit ?? 0;

  const planDisplay =
    plan?.display_name ?? PLAN_DISPLAY_NAMES[planoNome ?? ''] ?? planoNome ?? t('pages.dashboard.none');

  const usagePieData = useMemo(
    () =>
      [
        { name: t('pages.dashboard.kpiAudio'), value: audioUsed, color: '#8b5cf6' },
        { name: t('pages.dashboard.kpiText'), value: textUsed, color: '#3b82f6' },
        { name: t('pages.dashboard.kpiImage'), value: imageUsed, color: '#10b981' },
        { name: t('pages.dashboard.kpiVideo'), value: videoUsed, color: '#f59e0b' },
      ].filter((d) => d.value > 0),
    [t, audioUsed, textUsed, imageUsed, videoUsed]
  );

  const usageBarData = useMemo(
    () => [
      { name: t('pages.dashboard.kpiAudio'), usado: audioUsed, limite: audioLimit },
      { name: t('pages.dashboard.kpiText'), usado: textUsed, limite: textLimit },
      { name: t('pages.dashboard.kpiImage'), usado: imageUsed, limite: imageLimit },
      { name: t('pages.dashboard.kpiVideo'), usado: videoUsed, limite: videoLimit },
    ],
    [t, audioUsed, textUsed, imageUsed, videoUsed, audioLimit, textLimit, imageLimit, videoLimit]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">{t('pages.dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  const firstName = usuario?.nome?.split(' ')[0] ?? t('common.user');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 border-2 border-primary/20">
            <AvatarImage src={usuario?.avatar} alt={usuario?.nome} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
              {usuario?.nome?.charAt(0)?.toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              {t('pages.dashboard.hello', { name: firstName })}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('pages.dashboard.welcome')}
            </p>
          </div>
        </div>

        {planoNome && (
          <Badge
            variant="outline"
            className={`gap-1.5 px-3 py-1.5 text-sm font-semibold capitalize ${planColors[planoNome] ?? ''}`}
          >
            {planIcons[planoNome] ?? <CreditCard className="w-4 h-4" />}
            {t('pages.dashboard.planBadge')} {plan?.display_name ?? PLAN_DISPLAY_NAMES[planoNome ?? ''] ?? planoNome}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('pages.dashboard.account')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-lg font-semibold truncate">{usuario?.nome ?? '-'}</p>
            <p className="text-sm text-muted-foreground truncate">{usuario?.email ?? '-'}</p>
            <p className="text-xs text-muted-foreground">
              {t('pages.dashboard.memberSince')} {formatDate(usuario?.criadoEm)}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('pages.dashboard.subscription')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold capitalize">
                {planDisplay}
              </p>
              {billingStatus?.is_active && (
                <Badge variant="default" className="bg-green-600 text-xs">{t('common.active')}</Badge>
              )}
            </div>
            {plan && (
              <p className="text-muted-foreground text-sm">
                {currentPrice != null
                  ? isAnnualBilling
                    ? t('landing.plans.billedYear', { total: currentPrice.toFixed(2) })
                    : `R$ ${currentPrice.toFixed(2)}${t('landing.plans.perMonth')}`
                  : '-'}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {cancelAtPeriodEnd
                ? t('pages.payment.activeUntil', { date: formatDate(sub?.current_period_end) })
                : `${t('pages.dashboard.nextCharge')} ${formatDate(sub?.current_period_end)}`}
            </p>
            {nextPlanDisplay && (
              <p className="text-xs text-amber-600">
                {nextPlanDisplay}
                {nextPlanCycle === 'annual'
                  ? ` ${t('pages.payment.cycleAnnual')}`
                  : ` ${t('pages.payment.cycleMonthly')}`}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('pages.dashboard.quickActions')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button size="sm" onClick={() => navigate('/marketing-ai')} className="justify-start">
              <Megaphone className="w-4 h-4 mr-2" />
              {t('pages.dashboard.marketingAi')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/criar-site')} className="justify-start">
              <LayoutTemplate className="w-4 h-4 mr-2" />
              {t('pages.dashboard.createSite')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/ai-studio')} className="justify-start">
              <BrainCircuit className="w-4 h-4 mr-2" />
              {t('pages.dashboard.generateAi')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate('/pagamento')} className="justify-start">
              <CreditCard className="w-4 h-4 mr-2" />
              {t('pages.dashboard.managePlan')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Music className="w-5 h-5 text-violet-500" />}
          label={t('pages.dashboard.kpiAudio')}
          value={audioUsed}
          limit={audioLimit}
        />
        <KpiCard
          icon={<BrainCircuit className="w-5 h-5 text-blue-500" />}
          label={t('pages.dashboard.kpiText')}
          value={textUsed}
          limit={textLimit}
        />
        <KpiCard
          icon={<ImageIcon className="w-5 h-5 text-emerald-500" />}
          label={t('pages.dashboard.kpiImage')}
          value={imageUsed}
          limit={imageLimit}
        />
        <KpiCard
          icon={<Video className="w-5 h-5 text-amber-500" />}
          label={t('pages.dashboard.kpiVideo')}
          value={videoUsed}
          limit={videoLimit}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              {t('pages.dashboard.usageTitle')}
            </CardTitle>
            <CardDescription>
              {t('pages.dashboard.usageDesc', { plan: planDisplay })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {usageBarData.map((item) => (
              <UsageRow
                key={item.name}
                label={item.name}
                used={item.usado}
                limit={item.limite}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              {t('pages.dashboard.distributionTitle')}
            </CardTitle>
            <CardDescription>
              {t('pages.dashboard.distributionDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usagePieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                <BrainCircuit className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">{t('pages.dashboard.noUsage')}</p>
                <p className="text-xs mt-1">{t('pages.dashboard.noUsageHint')}</p>
              </div>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={usagePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {usagePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {sub && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              {t('pages.dashboard.periodTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t('pages.dashboard.start')}</span>{' '}
                <span className="font-medium">{formatDate(sub.start_date)}</span>
              </div>
              <div className="hidden sm:block text-muted-foreground">→</div>
              <div>
                <span className="text-muted-foreground">{t('pages.dashboard.nextRenewal')}</span>{' '}
                <span className="font-medium">{formatDate(sub.current_period_end)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('pages.dashboard.status')}</span>{' '}
                <Badge
                  variant="outline"
                  className={
                    sub.status === 'active'
                      ? 'border-green-500 text-green-600'
                      : 'border-amber-500 text-amber-600'
                  }
                >
                  {sub.status === 'active' ? t('common.active') : sub.status}
                </Badge>
              </div>
              <div className="sm:ml-auto">
                <Button variant="outline" size="sm" onClick={() => navigate('/pagamento')}>
                  {t('pages.dashboard.manageSubscription')}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  limit: number;
}

function KpiCard({ icon, label, value, limit }: KpiCardProps) {
  const { t } = useTranslation();
  const unlimited = limit <= 0;
  const percentage = pct(value, limit);
  const limLabel = unlimited ? t('common.unlimited') : String(limit);
  return (
    <Card className="rounded-xl hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">{label}</span>
          {icon}
        </div>
        <div className="flex items-end gap-1 flex-wrap">
          <span className="text-2xl font-bold">{value}</span>
          <span className="text-muted-foreground text-sm mb-0.5">
            / {limLabel}
          </span>
        </div>
        {!unlimited && <Progress value={percentage} className="h-2" />}
        <p className="text-xs text-muted-foreground">
          {unlimited ? t('pages.dashboard.noMonthlyLimit') : t('pages.dashboard.usagePct', { pct: percentage })}
        </p>
      </CardContent>
    </Card>
  );
}

interface UsageRowProps {
  label: string;
  used: number;
  limit: number;
}

function UsageRow({ label, used, limit }: UsageRowProps) {
  const { t } = useTranslation();
  const unlimited = limit <= 0;
  const percentage = pct(used, limit);
  const isHigh = !unlimited && percentage >= 80;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={`text-xs ${isHigh ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
          {unlimited
            ? t('pages.dashboard.unlimitedPair', { used })
            : `${used} / ${limit} (${percentage}%)`}
        </span>
      </div>
      {!unlimited && (
        <Progress
          value={percentage}
          className={`h-2.5 ${isHigh ? '[&>div]:bg-red-500' : ''}`}
        />
      )}
    </div>
  );
}
