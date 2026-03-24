/**
 * Dashboard.tsx
 * Maindashboard: REAL account info, subscription plan,
 * and usage data fetched from the FastAPI /billing endpoints.
 * All hardcoded mock data has been removed.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Sparkles,
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
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { PLAN_DISPLAY_NAMES } from '@/data/planos';

// ── Helpers ────────────────────────────────────────────────────────────────

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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Component ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { usuario, planoNome, billingStatus, fetchBillingStatus } = useAuthStore();
  const { workspaces, workspaceLimit, fetchWorkspaces } = useWorkspaceStore();
  const [loading, setLoading] = useState(!billingStatus);

  // Always fetch fresh billing data on mount (critical after Stripe redirect)
  useEffect(() => {
    Promise.all([fetchBillingStatus(), fetchWorkspaces()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────

  const sub = billingStatus?.subscription ?? null;
  const plan = sub?.plan ?? null;
  const usage = billingStatus?.usage ?? null;

  const postsUsed = usage?.usage?.posts_used ?? 0;
  const postsLimit = usage?.limits?.post_limit ?? 0;
  const textUsed = usage?.usage?.text_used ?? 0;
  const textLimit = usage?.limits?.text_limit ?? 0;
  const imageUsed = usage?.usage?.image_used ?? 0;
  const imageLimit = usage?.limits?.image_limit ?? 0;
  const videoUsed = usage?.usage?.video_used ?? 0;
  const videoLimit = usage?.limits?.video_limit ?? 0;

  // Build usage pie for the chart
  const usagePieData = [
    { name: 'Posts', value: postsUsed, color: '#8b5cf6' },
    { name: 'Texto IA', value: textUsed, color: '#3b82f6' },
    { name: 'Imagem IA', value: imageUsed, color: '#10b981' },
    { name: 'Vídeo IA', value: videoUsed, color: '#f59e0b' },
  ].filter((d) => d.value > 0);

  // Usage bar data
  const usageBarData = [
    { name: 'Posts', usado: postsUsed, limite: postsLimit },
    { name: 'Texto IA', usado: textUsed, limite: textLimit },
    { name: 'Imagem IA', usado: imageUsed, limite: imageLimit },
    { name: 'Vídeo IA', usado: videoUsed, limite: videoLimit },
  ];

  // ── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Carregando dashboard…</p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header: Welcome + Plan Badge ──────────────────────────────── */}
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
              Olá, {usuario?.nome?.split(' ')[0] ?? 'Usuário'}!
            </h1>
            <p className="text-muted-foreground text-sm">
              Bem-vindo(a) ao seu painel de controle
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {planoNome && (
            <Badge
              variant="outline"
              className={`gap-1.5 px-3 py-1.5 text-sm font-semibold capitalize ${planColors[planoNome] ?? ''}`}
            >
              {planIcons[planoNome] ?? <CreditCard className="w-4 h-4" />}
              Plano {plan?.display_name ?? PLAN_DISPLAY_NAMES[planoNome ?? ''] ?? planoNome}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Account & Subscription Info ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Account Card */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-lg font-semibold truncate">{usuario?.nome ?? '-'}</p>
            <p className="text-sm text-muted-foreground truncate">{usuario?.email ?? '-'}</p>
            <p className="text-xs text-muted-foreground">
              Membro desde {formatDate(usuario?.criadoEm)}
            </p>
          </CardContent>
        </Card>

        {/* Subscription Card */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assinatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold capitalize">
                {plan?.display_name ?? PLAN_DISPLAY_NAMES[planoNome ?? ''] ?? planoNome ?? 'Nenhum'}
              </p>
              {billingStatus?.is_active && (
                <Badge variant="default" className="bg-green-600 text-xs">Ativa</Badge>
              )}
            </div>
            {plan && (
              <p className="text-muted-foreground text-sm">
                R$ {plan.price_brl.toFixed(2)}/mês
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Próxima cobrança: {formatDate(sub?.current_period_end)}
            </p>
            <p className="text-xs text-muted-foreground">
              Workspaces: {workspaces.length}/{workspaceLimit === 0 ? '∞' : workspaceLimit}
            </p>
          </CardContent>
        </Card>

        {/* Quick Actions Card */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button size="sm" onClick={() => navigate('/marketing-ai')} className="justify-start">
              <Megaphone className="w-4 h-4 mr-2" />
              Marketing AI
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/criar-site')} className="justify-start">
              <LayoutTemplate className="w-4 h-4 mr-2" />
              Criar site
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/ai-studio')} className="justify-start">
              <Sparkles className="w-4 h-4 mr-2" />
              Gerar com IA
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate('/pagamento')} className="justify-start">
              <CreditCard className="w-4 h-4 mr-2" />
              Gerenciar Plano
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── KPI Cards: Usage ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<FileText className="w-5 h-5 text-purple-500" />}
          label="Posts Publicados"
          value={postsUsed}
          limit={postsLimit}
        />
        <KpiCard
          icon={<Sparkles className="w-5 h-5 text-blue-500" />}
          label="Gerações Texto IA"
          value={textUsed}
          limit={textLimit}
        />
        <KpiCard
          icon={<ImageIcon className="w-5 h-5 text-emerald-500" />}
          label="Gerações Imagem IA"
          value={imageUsed}
          limit={imageLimit}
        />
        <KpiCard
          icon={<Video className="w-5 h-5 text-amber-500" />}
          label="Gerações Vídeo IA"
          value={videoUsed}
          limit={videoLimit}
        />
      </div>

      {/* ── Charts Row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage Progress Bars */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Uso do Plano
            </CardTitle>
            <CardDescription>
              Consumo atual vs. limites do plano{' '}
              <span className="font-medium">{plan?.display_name ?? PLAN_DISPLAY_NAMES[planoNome ?? ''] ?? planoNome}</span>
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

        {/* Usage Distribution Pie */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Distribuição de Uso
            </CardTitle>
            <CardDescription>
              Como você está usando os recursos do seu plano
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usagePieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                <Sparkles className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">Nenhum uso registrado ainda.</p>
                <p className="text-xs mt-1">Comece criando posts ou gerando conteúdo com IA!</p>
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

      {/* ── Subscription Period ───────────────────────────────────────── */}
      {sub && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Período da Assinatura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Início:</span>{' '}
                <span className="font-medium">{formatDate(sub.start_date)}</span>
              </div>
              <div className="hidden sm:block text-muted-foreground">→</div>
              <div>
                <span className="text-muted-foreground">Próxima renovação:</span>{' '}
                <span className="font-medium">{formatDate(sub.current_period_end)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{' '}
                <Badge
                  variant="outline"
                  className={
                    sub.status === 'active'
                      ? 'border-green-500 text-green-600'
                      : 'border-amber-500 text-amber-600'
                  }
                >
                  {sub.status === 'active' ? 'Ativa' : sub.status}
                </Badge>
              </div>
              <div className="sm:ml-auto">
                <Button variant="outline" size="sm" onClick={() => navigate('/pagamento')}>
                  Gerenciar Assinatura
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

// ── Sub-components ─────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  limit: number;
}

function KpiCard({ icon, label, value, limit }: KpiCardProps) {
  const percentage = pct(value, limit);
  return (
    <Card className="rounded-xl hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">{label}</span>
          {icon}
        </div>
        <div className="flex items-end gap-1">
          <span className="text-2xl font-bold">{value}</span>
          <span className="text-muted-foreground text-sm mb-0.5">/ {limit}</span>
        </div>
        <Progress value={percentage} className="h-2" />
        <p className="text-xs text-muted-foreground">{percentage}% utilizado</p>
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
  const percentage = pct(used, limit);
  const isHigh = percentage >= 80;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={`text-xs ${isHigh ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
          {used} / {limit} ({percentage}%)
        </span>
      </div>
      <Progress
        value={percentage}
        className={`h-2.5 ${isHigh ? '[&>div]:bg-red-500' : ''}`}
      />
    </div>
  );
}
