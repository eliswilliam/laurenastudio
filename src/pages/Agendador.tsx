import { useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  GripVertical,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { PlataformaSocial } from '@/lib/types';

interface EventoCalendario {
  id: string;
  titulo: string;
  hora: string;
  plataforma: PlataformaSocial;
  status: 'agendado' | 'publicado' | 'rascunho';
}

interface DiaCalendario {
  dia: number;
  mesAtual: boolean;
  eventos: EventoCalendario[];
}

const coresPlataforma: Record<string, string> = {
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-600',
  twitter: 'bg-sky-500',
  linkedin: 'bg-blue-700',
  tiktok: 'bg-gray-900',
  youtube: 'bg-red-600',
};

const eventosMock: Record<number, EventoCalendario[]> = {
  2: [
    { id: '1', titulo: 'Post motivacional', hora: '09:00', plataforma: 'instagram', status: 'publicado' },
    { id: '2', titulo: 'Artigo sobre IA', hora: '14:00', plataforma: 'linkedin', status: 'publicado' },
  ],
  5: [
    { id: '3', titulo: 'Vídeo tutorial', hora: '10:00', plataforma: 'youtube', status: 'agendado' },
  ],
  8: [
    { id: '4', titulo: 'Promoção especial', hora: '12:00', plataforma: 'facebook', status: 'agendado' },
    { id: '5', titulo: 'Story interativo', hora: '18:00', plataforma: 'instagram', status: 'agendado' },
  ],
  12: [
    { id: '6', titulo: 'Thread educativa', hora: '08:00', plataforma: 'twitter', status: 'agendado' },
  ],
  15: [
    { id: '7', titulo: 'Campanha lançamento', hora: '09:00', plataforma: 'instagram', status: 'rascunho' },
    { id: '8', titulo: 'Anúncio produto', hora: '11:00', plataforma: 'facebook', status: 'rascunho' },
    { id: '9', titulo: 'Trend do momento', hora: '17:00', plataforma: 'tiktok', status: 'agendado' },
  ],
  20: [
    { id: '10', titulo: 'Webinar sobre marketing', hora: '15:00', plataforma: 'linkedin', status: 'agendado' },
  ],
  25: [
    { id: '11', titulo: 'Review do mês', hora: '10:00', plataforma: 'youtube', status: 'agendado' },
  ],
};

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function gerarDiasCalendario(ano: number, mes: number): DiaCalendario[] {
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const diasMesAnterior = new Date(ano, mes, 0).getDate();
  const dias: DiaCalendario[] = [];

  // Dias do mês anterior
  for (let i = primeiroDia - 1; i >= 0; i--) {
    dias.push({ dia: diasMesAnterior - i, mesAtual: false, eventos: [] });
  }

  // Dias do mês atual
  for (let i = 1; i <= diasNoMes; i++) {
    dias.push({
      dia: i,
      mesAtual: true,
      eventos: eventosMock[i] || [],
    });
  }

  // Completar com dias do próximo mês
  const restante = 42 - dias.length;
  for (let i = 1; i <= restante; i++) {
    dias.push({ dia: i, mesAtual: false, eventos: [] });
  }

  return dias;
}

export default function Agendador() {
  const [mesAtual, setMesAtual] = useState(2); // Março (0-indexed)
  const [anoAtual, setAnoAtual] = useState(2026);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null);
  const { toast } = useToast();

  const dias = gerarDiasCalendario(anoAtual, mesAtual);

  const mesAnterior = () => {
    if (mesAtual === 0) {
      setMesAtual(11);
      setAnoAtual(anoAtual - 1);
    } else {
      setMesAtual(mesAtual - 1);
    }
  };

  const mesSeguinte = () => {
    if (mesAtual === 11) {
      setMesAtual(0);
      setAnoAtual(anoAtual + 1);
    } else {
      setMesAtual(mesAtual + 1);
    }
  };

  const handleAgendar = () => {
    toast({ title: 'Post agendado!', description: `Post agendado para ${diaSelecionado} de ${meses[mesAtual]}.` });
    setDialogAberto(false);
  };

  const hoje = new Date();
  const isHoje = (dia: number, mesAtualFlag: boolean) =>
    mesAtualFlag && dia === hoje.getDate() && mesAtual === hoje.getMonth() && anoAtual === hoje.getFullYear();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            Agendador
          </h1>
          <p className="text-muted-foreground">
            Agende e gerencie suas publicações no calendário.
          </p>
        </div>
        <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Agendar Post
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar Novo Post</DialogTitle>
              <DialogDescription>
                Preencha os dados do post que deseja agendar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input placeholder="Título do post" />
              </div>
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Textarea placeholder="Conteúdo do post..." className="resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    defaultValue={
                      diaSelecionado
                        ? `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(diaSelecionado).padStart(2, '0')}`
                        : ''
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Input type="time" defaultValue="09:00" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Plataformas</Label>
                <div className="flex flex-wrap gap-3">
                  {(['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube'] as PlataformaSocial[]).map((p) => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox />
                      <span className="text-sm capitalize">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAgendar}>Agendar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Calendário */}
      <Card className="rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">
            {meses[mesAtual]} {anoAtual}
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={mesAnterior}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                setMesAtual(hoje.getMonth());
                setAnoAtual(hoje.getFullYear());
              }}
            >
              Hoje
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={mesSeguinte}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 mb-2">
            {diasSemana.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Grid do calendário */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {dias.map((dia, i) => (
              <div
                key={i}
                className={`min-h-[100px] p-1.5 bg-card transition-colors cursor-pointer hover:bg-muted/50 ${
                  !dia.mesAtual ? 'opacity-40' : ''
                } ${isHoje(dia.dia, dia.mesAtual) ? 'ring-2 ring-primary ring-inset' : ''}`}
                onClick={() => {
                  if (dia.mesAtual) {
                    setDiaSelecionado(dia.dia);
                    setDialogAberto(true);
                  }
                }}
              >
                <div
                  className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isHoje(dia.dia, dia.mesAtual) ? 'bg-primary text-primary-foreground' : ''
                  }`}
                >
                  {dia.dia}
                </div>
                <div className="space-y-1">
                  {dia.eventos.slice(0, 2).map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-1 text-[10px] bg-muted/80 rounded px-1.5 py-0.5 truncate"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${coresPlataforma[ev.plataforma]} shrink-0`} />
                      <span className="truncate">{ev.titulo}</span>
                    </div>
                  ))}
                  {dia.eventos.length > 2 && (
                    <p className="text-[10px] text-muted-foreground pl-1">
                      +{dia.eventos.length - 2} mais
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Posts agendados para hoje */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Próximos Posts Agendados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(eventosMock)
              .flatMap(([dia, eventos]) =>
                eventos
                  .filter((e) => e.status === 'agendado')
                  .map((e) => ({ ...e, dia: Number(dia) }))
              )
              .sort((a, b) => a.dia - b.dia)
              .slice(0, 5)
              .map((evento) => (
                <div
                  key={evento.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                  <div className={`w-2 h-8 rounded-full ${coresPlataforma[evento.plataforma]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{evento.titulo}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{evento.dia} de {meses[mesAtual]} às {evento.hora}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {evento.plataforma}
                      </Badge>
                    </div>
                  </div>
                  <Badge
                    variant={evento.status === 'publicado' ? 'default' : 'secondary'}
                    className="capitalize shrink-0"
                  >
                    {evento.status}
                  </Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
