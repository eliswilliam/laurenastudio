import { useMemo, useState } from 'react';
import {
  Megaphone,
  Calendar,
  TrendingUp,
  DollarSign,
  MousePointerClick,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Campanha, PlataformaAds } from '@/lib/types';
import { useTranslation } from '@/hooks/useTranslation';

const dadosAdsTimeline = [
  { nome: 'Sem 1', gasto: 2100, conversoes: 320, roas: 3.8 },
  { nome: 'Sem 2', gasto: 2400, conversoes: 380, roas: 4.1 },
  { nome: 'Sem 3', gasto: 2800, conversoes: 450, roas: 4.5 },
  { nome: 'Sem 4', gasto: 3100, conversoes: 520, roas: 4.2 },
  { nome: 'Sem 5', gasto: 2900, conversoes: 490, roas: 4.3 },
  { nome: 'Sem 6', gasto: 3400, conversoes: 580, roas: 4.6 },
  { nome: 'Sem 7', gasto: 3200, conversoes: 540, roas: 4.4 },
  { nome: 'Sem 8', gasto: 3600, conversoes: 620, roas: 4.8 },
];

const campanhasMock: Campanha[] = [
  { id: '1', nome: 'Campanha Black Friday', plataforma: 'meta', status: 'ativa', orcamento: 5000, gasto: 3200, impressoes: 450000, cliques: 12000, conversoes: 840, cpc: 0.27, cpa: 3.81, roas: 5.2 },
  { id: '2', nome: 'Lançamento Produto X', plataforma: 'google', status: 'ativa', orcamento: 3000, gasto: 1800, impressoes: 280000, cliques: 8500, conversoes: 420, cpc: 0.21, cpa: 4.29, roas: 4.1 },
  { id: '3', nome: 'Awareness Marca Q1', plataforma: 'meta', status: 'ativa', orcamento: 8000, gasto: 6500, impressoes: 1200000, cliques: 35000, conversoes: 1200, cpc: 0.19, cpa: 5.42, roas: 3.8 },
  { id: '4', nome: 'Retargeting Carrinho', plataforma: 'meta', status: 'pausada', orcamento: 2000, gasto: 1200, impressoes: 180000, cliques: 5400, conversoes: 310, cpc: 0.22, cpa: 3.87, roas: 6.1 },
  { id: '5', nome: 'TikTok Viral Challenge', plataforma: 'tiktok', status: 'ativa', orcamento: 4000, gasto: 2800, impressoes: 890000, cliques: 25000, conversoes: 680, cpc: 0.11, cpa: 4.12, roas: 3.5 },
  { id: '6', nome: 'Google Search - Brand', plataforma: 'google', status: 'finalizada', orcamento: 1500, gasto: 1500, impressoes: 95000, cliques: 4200, conversoes: 380, cpc: 0.36, cpa: 3.95, roas: 7.2 },
];

const corPlataforma: Record<PlataformaAds, string> = {
  meta: 'bg-blue-600 text-white',
  google: 'bg-green-600 text-white',
  tiktok: 'bg-gray-900 text-white',
};

const labelPlataforma: Record<PlataformaAds, string> = {
  meta: 'Meta Ads',
  google: 'Google Ads',
  tiktok: 'TikTok Ads',
};

export default function AdsAnalytics() {
  const { t, i18n } = useTranslation();
  const [plataformaFiltro, setPlataformaFiltro] = useState<string>('todas');
  const [statusFiltro, setStatusFiltro] = useState<string>('todas');
  const locale = i18n.language;

  const kpisAds = useMemo(
    () => [
      {
        id: 'cpc' as const,
        titulo: t('pages.adsAnalytics.kpiCpc'),
        valor: 'R$ 1,42',
        variacao: -8.3,
        icone: MousePointerClick,
        cor: 'text-blue-500',
        bg: 'bg-blue-500/10',
      },
      {
        id: 'cpa' as const,
        titulo: t('pages.adsAnalytics.kpiCpa'),
        valor: 'R$ 28,50',
        variacao: -12.1,
        icone: Target,
        cor: 'text-green-500',
        bg: 'bg-green-500/10',
      },
      {
        id: 'roas' as const,
        titulo: t('pages.adsAnalytics.kpiRoas'),
        valor: '4.2x',
        variacao: 15.7,
        icone: TrendingUp,
        cor: 'text-primary',
        bg: 'bg-primary/10',
      },
      {
        id: 'conv' as const,
        titulo: t('pages.adsAnalytics.kpiConversions'),
        valor: '3.847',
        variacao: 22.4,
        icone: DollarSign,
        cor: 'text-orange-500',
        bg: 'bg-orange-500/10',
      },
    ],
    [t]
  );

  const statusLabel = useMemo(
    () => ({
      ativa: t('pages.adsAnalytics.statusActive'),
      pausada: t('pages.adsAnalytics.statusPaused'),
      finalizada: t('pages.adsAnalytics.statusCompleted'),
    }),
    [t]
  );

  const campanhasFiltradas = campanhasMock.filter((c) => {
    if (plataformaFiltro !== 'todas' && c.plataforma !== plataformaFiltro) return false;
    if (statusFiltro !== 'todas' && c.status !== statusFiltro) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" />
            {t('nav.adsAnalytics')}
          </h1>
          <p className="text-muted-foreground">{t('pages.adsAnalytics.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" className="w-[150px] h-9" defaultValue="2026-02-01" />
          <span className="text-muted-foreground">{t('pages.adsAnalytics.dateTo')}</span>
          <Input type="date" className="w-[150px] h-9" defaultValue="2026-03-02" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpisAds.map((kpi) => {
          const Icon = kpi.icone;
          const lowerIsBetter = kpi.id === 'cpc' || kpi.id === 'cpa';
          const positivo = lowerIsBetter ? kpi.variacao <= 0 : kpi.variacao >= 0;
          return (
            <Card key={kpi.id} className="rounded-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${kpi.cor}`} />
                  </div>
                  <div
                    className={`flex items-center gap-1 text-xs font-medium ${positivo ? 'text-green-600' : 'text-red-500'}`}
                  >
                    {positivo ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {Math.abs(kpi.variacao)}%
                  </div>
                </div>
                <p className="text-2xl font-bold">{kpi.valor}</p>
                <p className="text-sm text-muted-foreground mt-1">{kpi.titulo}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">{t('pages.adsAnalytics.chartSpendConvTitle')}</CardTitle>
            <CardDescription>{t('pages.adsAnalytics.chartSpendConvDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosAdsTimeline}>
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
                <Legend />
                <Bar
                  dataKey="gasto"
                  fill="hsl(16, 53%, 50%)"
                  radius={[4, 4, 0, 0]}
                  name={t('pages.adsAnalytics.legendSpend')}
                />
                <Bar
                  dataKey="conversoes"
                  fill="hsl(140, 60%, 50%)"
                  radius={[4, 4, 0, 0]}
                  name={t('pages.adsAnalytics.legendConversions')}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">{t('pages.adsAnalytics.chartRoasTitle')}</CardTitle>
            <CardDescription>{t('pages.adsAnalytics.chartRoasDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dadosAdsTimeline}>
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
                  dataKey="roas"
                  stroke="hsl(40, 90%, 55%)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'hsl(40, 90%, 55%)' }}
                  name="ROAS"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-base">{t('pages.adsAnalytics.campaignsTitle')}</CardTitle>
            <CardDescription>{t('pages.adsAnalytics.campaignsDesc')}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={plataformaFiltro} onValueChange={setPlataformaFiltro}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder={t('pages.adsAnalytics.filterPlatform')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">{t('pages.adsAnalytics.allPlatforms')}</SelectItem>
                <SelectItem value="meta">Meta Ads</SelectItem>
                <SelectItem value="google">Google Ads</SelectItem>
                <SelectItem value="tiktok">TikTok Ads</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder={t('pages.adsAnalytics.filterStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">{t('pages.adsAnalytics.allStatuses')}</SelectItem>
                <SelectItem value="ativa">{t('pages.adsAnalytics.statusActive')}</SelectItem>
                <SelectItem value="pausada">{t('pages.adsAnalytics.statusPaused')}</SelectItem>
                <SelectItem value="finalizada">{t('pages.adsAnalytics.statusCompleted')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left font-medium text-muted-foreground pb-3">
                    {t('pages.adsAnalytics.colCampaign')}
                  </th>
                  <th className="text-left font-medium text-muted-foreground pb-3">
                    {t('pages.adsAnalytics.colPlatform')}
                  </th>
                  <th className="text-left font-medium text-muted-foreground pb-3">
                    {t('pages.adsAnalytics.colStatus')}
                  </th>
                  <th className="text-right font-medium text-muted-foreground pb-3">
                    {t('pages.adsAnalytics.colSpend')}
                  </th>
                  <th className="text-right font-medium text-muted-foreground pb-3">
                    {t('pages.adsAnalytics.colImpressions')}
                  </th>
                  <th className="text-right font-medium text-muted-foreground pb-3">
                    {t('pages.adsAnalytics.colClicks')}
                  </th>
                  <th className="text-right font-medium text-muted-foreground pb-3">
                    {t('pages.adsAnalytics.colCpc')}
                  </th>
                  <th className="text-right font-medium text-muted-foreground pb-3">
                    {t('pages.adsAnalytics.colCpa')}
                  </th>
                  <th className="text-right font-medium text-muted-foreground pb-3">
                    {t('pages.adsAnalytics.colRoas')}
                  </th>
                  <th className="text-right font-medium text-muted-foreground pb-3">
                    {t('pages.adsAnalytics.colConversions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {campanhasFiltradas.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-3 font-medium">{c.nome}</td>
                    <td className="py-3">
                      <Badge className={`${corPlataforma[c.plataforma]} text-xs`}>
                        {labelPlataforma[c.plataforma]}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Badge
                        variant={c.status === 'ativa' ? 'default' : c.status === 'pausada' ? 'secondary' : 'outline'}
                      >
                        {statusLabel[c.status]}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">R$ {c.gasto.toLocaleString(locale)}</td>
                    <td className="py-3 text-right">{c.impressoes.toLocaleString(locale)}</td>
                    <td className="py-3 text-right">{c.cliques.toLocaleString(locale)}</td>
                    <td className="py-3 text-right">R$ {c.cpc.toFixed(2)}</td>
                    <td className="py-3 text-right">R$ {c.cpa.toFixed(2)}</td>
                    <td className="py-3 text-right font-medium text-green-600">{c.roas.toFixed(1)}x</td>
                    <td className="py-3 text-right font-medium">{c.conversoes.toLocaleString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
