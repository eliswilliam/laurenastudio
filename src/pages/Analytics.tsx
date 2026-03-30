import { useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Eye,
  MousePointerClick,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';

const MONTH_KEYS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

const dadosMensaisRaw = [
  { impressoes: 45200, engajamento: 3200, cliques: 1800, seguidores: 12400 },
  { impressoes: 52000, engajamento: 4100, cliques: 2200, seguidores: 13100 },
  { impressoes: 61000, engajamento: 5300, cliques: 2800, seguidores: 14200 },
  { impressoes: 58000, engajamento: 4800, cliques: 2500, seguidores: 14900 },
  { impressoes: 67000, engajamento: 5900, cliques: 3100, seguidores: 16100 },
  { impressoes: 72000, engajamento: 6500, cliques: 3400, seguidores: 17500 },
  { impressoes: 81000, engajamento: 7200, cliques: 3800, seguidores: 19200 },
  { impressoes: 78000, engajamento: 6800, cliques: 3600, seguidores: 20100 },
  { impressoes: 85000, engajamento: 7800, cliques: 4100, seguidores: 21800 },
  { impressoes: 92000, engajamento: 8500, cliques: 4500, seguidores: 23500 },
  { impressoes: 98000, engajamento: 9200, cliques: 4800, seguidores: 25200 },
  { impressoes: 105000, engajamento: 10100, cliques: 5200, seguidores: 27000 },
];

const dadosPlataforma = [
  { plataforma: 'Instagram', impressoes: 320000, engajamento: 28000, seguidores: 45000 },
  { plataforma: 'Facebook', impressoes: 210000, engajamento: 18000, seguidores: 32000 },
  { plataforma: 'LinkedIn', impressoes: 150000, engajamento: 12000, seguidores: 18000 },
  { plataforma: 'TikTok', impressoes: 130000, engajamento: 15000, seguidores: 22000 },
  { plataforma: 'Twitter', impressoes: 82000, engajamento: 6400, seguidores: 10000 },
];

export default function Analytics() {
  const { t } = useTranslation();
  const [periodo, setPeriodo] = useState('12m');

  const dadosMensais = useMemo(
    () =>
      dadosMensaisRaw.map((row, i) => ({
        nome: t(`pages.analytics.months.${MONTH_KEYS[i]}`),
        ...row,
      })),
    [t]
  );

  const metricas = useMemo(
    () => [
      {
        titulo: t('pages.analytics.metricImpressions'),
        valor: '892K',
        variacao: 15.3,
        icone: Eye,
        cor: 'text-blue-500',
        bg: 'bg-blue-500/10',
      },
      {
        titulo: t('pages.analytics.metricEngagement'),
        valor: '79.4K',
        variacao: 22.1,
        icone: TrendingUp,
        cor: 'text-green-500',
        bg: 'bg-green-500/10',
      },
      {
        titulo: t('pages.analytics.metricClicks'),
        valor: '41.8K',
        variacao: 18.7,
        icone: MousePointerClick,
        cor: 'text-primary',
        bg: 'bg-primary/10',
      },
      {
        titulo: t('pages.analytics.metricFollowers'),
        valor: '+14.6K',
        variacao: 12.4,
        icone: Users,
        cor: 'text-orange-500',
        bg: 'bg-orange-500/10',
      },
    ],
    [t]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            {t('nav.analytics')}
          </h1>
          <p className="text-muted-foreground">{t('pages.analytics.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t('pages.analytics.period7d')}</SelectItem>
              <SelectItem value="30d">{t('pages.analytics.period30d')}</SelectItem>
              <SelectItem value="3m">{t('pages.analytics.period3m')}</SelectItem>
              <SelectItem value="6m">{t('pages.analytics.period6m')}</SelectItem>
              <SelectItem value="12m">{t('pages.analytics.period12m')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricas.map((m) => {
          const Icon = m.icone;
          const positivo = m.variacao >= 0;
          return (
            <Card key={m.titulo} className="rounded-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-lg ${m.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${m.cor}`} />
                  </div>
                  <div
                    className={`flex items-center gap-1 text-xs font-medium ${positivo ? 'text-green-600' : 'text-red-500'}`}
                  >
                    {positivo ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {Math.abs(m.variacao)}%
                  </div>
                </div>
                <p className="text-2xl font-bold">{m.valor}</p>
                <p className="text-sm text-muted-foreground mt-1">{m.titulo}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="impressoes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="impressoes">{t('pages.analytics.tabImpressions')}</TabsTrigger>
          <TabsTrigger value="engajamento">{t('pages.analytics.tabEngagement')}</TabsTrigger>
          <TabsTrigger value="cliques">{t('pages.analytics.tabClicks')}</TabsTrigger>
          <TabsTrigger value="crescimento">{t('pages.analytics.tabGrowth')}</TabsTrigger>
        </TabsList>

        <TabsContent value="impressoes">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">{t('pages.analytics.chartImpTitle')}</CardTitle>
              <CardDescription>{t('pages.analytics.chartImpDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={dadosMensais}>
                  <defs>
                    <linearGradient id="gradImp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(16, 53%, 50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(16, 53%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="impressoes"
                    stroke="hsl(16, 53%, 50%)"
                    fill="url(#gradImp)"
                    strokeWidth={2}
                    name={t('pages.analytics.legendImpressions')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engajamento">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">{t('pages.analytics.chartEngTitle')}</CardTitle>
              <CardDescription>{t('pages.analytics.chartEngDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={dadosMensais}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar
                    dataKey="engajamento"
                    fill="hsl(140, 60%, 50%)"
                    radius={[4, 4, 0, 0]}
                    name={t('pages.analytics.legendEngagement')}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cliques">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">{t('pages.analytics.chartClkTitle')}</CardTitle>
              <CardDescription>{t('pages.analytics.chartClkDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={dadosMensais}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cliques"
                    stroke="hsl(190, 80%, 50%)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name={t('pages.analytics.legendClicks')}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crescimento">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">{t('pages.analytics.chartGrowthTitle')}</CardTitle>
              <CardDescription>{t('pages.analytics.chartGrowthDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={dadosMensais}>
                  <defs>
                    <linearGradient id="gradCresc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(40, 90%, 55%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(40, 90%, 55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="seguidores"
                    stroke="hsl(40, 90%, 55%)"
                    fill="url(#gradCresc)"
                    strokeWidth={2}
                    name={t('pages.analytics.legendFollowers')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">{t('pages.analytics.platformPerfTitle')}</CardTitle>
          <CardDescription>{t('pages.analytics.platformPerfDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosPlataforma} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                type="category"
                dataKey="plataforma"
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar
                dataKey="impressoes"
                fill="hsl(16, 53%, 50%)"
                radius={[0, 4, 4, 0]}
                name={t('pages.analytics.legendImpressions')}
              />
              <Bar
                dataKey="engajamento"
                fill="hsl(190, 80%, 50%)"
                radius={[0, 4, 4, 0]}
                name={t('pages.analytics.legendEngagement')}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
