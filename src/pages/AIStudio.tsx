import { useState } from 'react';
import {
  Sparkles,
  Type,
  Image,
  Video,
  RefreshCw,
  Save,
  Copy,
  Download,
  Wand2,
  Loader2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAIStore } from '@/store/useAIStore';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

const tons = [
  { value: 'profissional', label: 'Profissional' },
  { value: 'casual', label: 'Casual' },
  { value: 'humoristico', label: 'Humorístico' },
  { value: 'inspirador', label: 'Inspirador' },
  { value: 'educativo', label: 'Educativo' },
  { value: 'persuasivo', label: 'Persuasivo' },
];

const plataformas = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
];

const vozesMarca = [
  { value: 'corporativo', label: 'Corporativo' },
  { value: 'amigavel', label: 'Amigável' },
  { value: 'ousado', label: 'Ousado' },
  { value: 'elegante', label: 'Elegante' },
  { value: 'minimalista', label: 'Minimalista' },
];

export default function AIStudio() {
  const {
    prompt,
    tipo,
    tom,
    plataforma,
    vozMarca,
    isGerando,
    resultado,
    setPrompt,
    setTipo,
    setTom,
    setPlataforma,
    setVozMarca,
    setGerando,
    setResultado,
  } = useAIStore();

  const { toast } = useToast();
  const [abaAtiva, setAbaAtiva] = useState('texto');

  const handleGerar = async () => {
    if (!prompt.trim()) {
      toast({ title: 'Atenção', description: 'Digite um prompt para gerar conteúdo.', variant: 'destructive' });
      return;
    }

    setGerando(true);
    setResultado(null);

    try {
      const resourceType = abaAtiva as 'texto' | 'imagem' | 'video';
      const typeMap: Record<string, string> = { texto: 'text', imagem: 'image', video: 'video' };

      // Video generation takes longer (polling Veo)
      const timeout = resourceType === 'video' ? 600000 : 120000;

      const { data } = await api.post('/ai/generate', {
        resource_type: typeMap[resourceType],
        prompt,
        style: tom,
      }, { timeout });

      const isMedia = resourceType === 'imagem' || resourceType === 'video';

      setResultado({
        id: Date.now().toString(),
        conteudo: data.content,
        tipo: resourceType,
        urlPreview: isMedia ? data.content : undefined,
        criadoEm: new Date().toISOString(),
      });

      toast({ title: 'Conteúdo gerado!', description: data.message || 'Seu conteúdo foi criado com sucesso pela IA.' });
    } catch (err: any) {
      toast({
        title: 'Erro na geração',
        description: err.message || 'Falha ao gerar conteúdo. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setGerando(false);
    }
  };

  const handleCopiar = () => {
    if (resultado?.conteudo) {
      navigator.clipboard.writeText(resultado.conteudo);
      toast({ title: 'Copiado!', description: 'Conteúdo copiado para a área de transferência.' });
    }
  };

  const handleSalvar = () => {
    toast({ title: 'Salvo!', description: 'Conteúdo salvo na biblioteca de mídia.' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">AI Studio</h1>
        </div>
        <p className="text-muted-foreground">
          Gere conteúdo de alta qualidade usando inteligência artificial.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Painel de entrada */}
        <div className="xl:col-span-2 space-y-6">
          {/* Abas de tipo */}
          <Tabs value={abaAtiva} onValueChange={(v) => { setAbaAtiva(v); setResultado(null); }}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="texto" className="gap-2">
                <Type className="w-4 h-4" />
                Texto
              </TabsTrigger>
              <TabsTrigger value="imagem" className="gap-2">
                <Image className="w-4 h-4" />
                Imagem
              </TabsTrigger>
              <TabsTrigger value="video" className="gap-2">
                <Video className="w-4 h-4" />
                Vídeo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="texto" className="mt-4">
              <p className="text-sm text-muted-foreground">
                Gere textos para posts, legendas, artigos e muito mais.
              </p>
            </TabsContent>
            <TabsContent value="imagem" className="mt-4">
              <p className="text-sm text-muted-foreground">
                Crie imagens únicas para suas redes sociais com IA generativa.
              </p>
            </TabsContent>
            <TabsContent value="video" className="mt-4">
              <p className="text-sm text-muted-foreground">
                Gere vídeos cinematográficos com IA generativa (Veo 3.1).
              </p>
            </TabsContent>
          </Tabs>

          {/* Prompt */}
          <Card className="rounded-xl">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label>Prompt</Label>
                <Textarea
                  placeholder="Descreva o conteúdo que deseja gerar... Ex: Crie um post motivacional para Instagram sobre empreendedorismo digital."
                  className="min-h-[120px] resize-none"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tom do conteúdo</Label>
                  <Select value={tom} onValueChange={(v) => setTom(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tons.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select value={plataforma} onValueChange={(v) => setPlataforma(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {plataformas.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Voz da marca</Label>
                <Select value={vozMarca} onValueChange={(v) => setVozMarca(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vozesMarca.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full h-11 gap-2"
                onClick={handleGerar}
                disabled={isGerando}
              >
                {isGerando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Gerar Conteúdo
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Sugestões rápidas */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Sugestões Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {[
                'Post motivacional para Instagram',
                'Legenda para produto no Facebook',
                'Thread informativa para Twitter',
                'Artigo profissional no LinkedIn',
                'Descrição criativa para TikTok',
                'Roteiro de vídeo para YouTube',
              ].map((sugestao) => (
                <Badge
                  key={sugestao}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                  onClick={() => setPrompt(sugestao)}
                >
                  {sugestao}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Painel de resultado */}
        <div className="xl:col-span-3">
          <Card className="rounded-xl h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Preview do Conteúdo</CardTitle>
                <CardDescription>
                  {resultado
                    ? 'Conteúdo gerado com sucesso'
                    : 'O resultado da geração aparecerá aqui'}
                </CardDescription>
              </div>
              {resultado && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopiar}>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSalvar}>
                    <Save className="w-3.5 h-3.5" />
                    Salvar
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleGerar}>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerar
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isGerando ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">Gerando conteúdo...</p>
                    <p className="text-sm text-muted-foreground">
                      {abaAtiva === 'video'
                        ? 'Gerando vídeo com Veo 3.1... Isso pode levar alguns minutos.'
                        : 'Nossa IA está criando algo incrível para você.'}
                    </p>
                  </div>
                </div>
              ) : resultado ? (
                <div className="space-y-4">
                  {resultado.tipo === 'texto' ? (
                    <div className="bg-muted/50 rounded-xl p-6 whitespace-pre-wrap text-sm leading-relaxed border">
                      {resultado.conteudo}
                    </div>
                  ) : resultado.tipo === 'video' ? (
                    <div className="space-y-4">
                      <div className="rounded-xl overflow-hidden border bg-muted/30">
                        <video
                          src={resultado.urlPreview}
                          controls
                          className="w-full h-auto max-h-[500px]"
                          autoPlay
                          loop
                        />
                      </div>
                      <div className="flex justify-center">
                        <a
                          href={resultado.urlPreview}
                          download
                          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <Download className="w-4 h-4" />
                          Baixar vídeo
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-xl overflow-hidden border bg-muted/30">
                        <img
                          src={resultado.urlPreview}
                          alt="Conteúdo gerado"
                          className="w-full h-auto max-h-96 object-cover"
                        />
                      </div>
                    </div>
                  )}

                  {/* Metadados do resultado */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Badge variant="outline">{abaAtiva === 'texto' ? 'Texto' : abaAtiva === 'imagem' ? 'Imagem' : 'Vídeo'}</Badge>
                    <Badge variant="outline">{tons.find((t) => t.value === tom)?.label}</Badge>
                    <Badge variant="outline">{plataformas.find((p) => p.value === plataforma)?.label}</Badge>
                    <Badge variant="outline">{vozesMarca.find((v) => v.value === vozMarca)?.label}</Badge>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wand2 className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Nenhum conteúdo gerado ainda</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Preencha o prompt e clique em "Gerar Conteúdo" para começar.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
