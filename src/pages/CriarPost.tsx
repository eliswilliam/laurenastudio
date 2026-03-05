import { useState } from 'react';
import {
  PenSquare,
  Image,
  Sparkles,
  Send,
  Save,
  CalendarDays,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import type { PlataformaSocial } from '@/lib/types';

const plataformasDisponiveis: { value: PlataformaSocial; label: string; cor: string }[] = [
  { value: 'instagram', label: 'Instagram', cor: 'bg-pink-500' },
  { value: 'facebook', label: 'Facebook', cor: 'bg-blue-600' },
  { value: 'twitter', label: 'Twitter/X', cor: 'bg-sky-500' },
  { value: 'linkedin', label: 'LinkedIn', cor: 'bg-blue-700' },
  { value: 'tiktok', label: 'TikTok', cor: 'bg-gray-900' },
  { value: 'youtube', label: 'YouTube', cor: 'bg-red-600' },
];

export default function CriarPost() {
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [plataformas, setPlataformas] = useState<PlataformaSocial[]>([]);
  const [imagens, setImagens] = useState<string[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const togglePlataforma = (p: PlataformaSocial) => {
    setPlataformas((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handlePublicar = () => {
    toast({ title: 'Post publicado!', description: 'Seu conteúdo foi publicado com sucesso.' });
  };

  const handleSalvarRascunho = () => {
    toast({ title: 'Rascunho salvo!', description: 'Seu post foi salvo como rascunho.' });
  };

  const handleAgendar = () => {
    navigate('/agendador');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PenSquare className="w-6 h-6 text-primary" />
            Criar Post
          </h1>
          <p className="text-muted-foreground">
            Crie e publique conteúdo nas suas redes sociais.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => navigate('/ai-studio')}>
          <Sparkles className="w-4 h-4" />
          Gerar com IA
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-xl">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  placeholder="Título do seu post..."
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Textarea
                  placeholder="Escreva o conteúdo do seu post aqui..."
                  className="min-h-[200px] resize-none"
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {conteudo.length} caracteres
                </p>
              </div>

              {/* Upload de imagens */}
              <div className="space-y-2">
                <Label>Mídia</Label>
                <div className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Arraste imagens ou clique para fazer upload
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG, GIF até 10MB
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar de configurações */}
        <div className="space-y-4">
          {/* Plataformas */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Publicar em</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {plataformasDisponiveis.map((p) => (
                <label
                  key={p.value}
                  className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                >
                  <Checkbox
                    checked={plataformas.includes(p.value)}
                    onCheckedChange={() => togglePlataforma(p.value)}
                  />
                  <div className={`w-3 h-3 rounded-full ${p.cor}`} />
                  <span className="text-sm font-medium">{p.label}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          {/* Ações */}
          <Card className="rounded-xl">
            <CardContent className="p-5 space-y-3">
              <Button className="w-full gap-2" onClick={handlePublicar}>
                <Send className="w-4 h-4" />
                Publicar Agora
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={handleAgendar}>
                <CalendarDays className="w-4 h-4" />
                Agendar
              </Button>
              <Button variant="ghost" className="w-full gap-2" onClick={handleSalvarRascunho}>
                <Save className="w-4 h-4" />
                Salvar Rascunho
              </Button>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4 min-h-[100px]">
                {conteudo ? (
                  <p className="text-sm whitespace-pre-wrap">{conteudo.slice(0, 280)}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    O preview do seu post aparecerá aqui...
                  </p>
                )}
              </div>
              {plataformas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {plataformas.map((p) => (
                    <Badge key={p} variant="secondary" className="text-xs capitalize">
                      {p}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
