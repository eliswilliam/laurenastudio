import { useState } from 'react';
import {
  PenSquare,
  Image,
  BrainCircuit,
  Send,
  Save,
  CalendarDays,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { socialIcons } from '@/components/shared/SocialIcons';
import { useTranslation } from '@/hooks/useTranslation';
import type { PlataformaSocial } from '@/lib/types';

const plataformasDisponiveis: { value: PlataformaSocial; label: string; cor: string }[] = [
  { value: 'instagram', label: 'Instagram', cor: 'text-pink-500' },
  { value: 'facebook', label: 'Facebook', cor: 'text-blue-600' },
  { value: 'twitter', label: 'Twitter/X', cor: 'text-gray-900 dark:text-gray-100' },
  { value: 'linkedin', label: 'LinkedIn', cor: 'text-blue-700' },
  { value: 'tiktok', label: 'TikTok', cor: 'text-gray-900 dark:text-gray-100' },
  { value: 'youtube', label: 'YouTube', cor: 'text-red-600' },
];

export default function CriarPost() {
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [plataformas, setPlataformas] = useState<PlataformaSocial[]>([]);
  const [imagens, setImagens] = useState<string[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const togglePlataforma = (p: PlataformaSocial) => {
    setPlataformas((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handlePublicar = () => {
    toast({
      title: t('pages.createPost.published'),
      description: t('pages.createPost.publishedDesc'),
    });
  };

  const handleSalvarRascunho = () => {
    toast({
      title: t('pages.createPost.draftSaved'),
      description: t('pages.createPost.draftSavedDesc'),
    });
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
            {t('pages.createPost.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('pages.createPost.subtitle')}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => navigate('/ai-studio')}>
          <BrainCircuit className="w-4 h-4" />
          {t('pages.createPost.generateAi')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-xl">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label>{t('pages.createPost.labelTitle')}</Label>
                <Input
                  placeholder={t('pages.createPost.placeholderTitle')}
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('pages.createPost.labelContent')}</Label>
                <Textarea
                  placeholder={t('pages.createPost.placeholderContent')}
                  className="min-h-[200px] resize-none"
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {t('pages.createPost.chars', { n: conteudo.length })}
                </p>
              </div>

              {/* Upload de imagens */}
              <div className="space-y-2">
                <Label>{t('pages.createPost.labelMedia')}</Label>
                <div className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t('pages.createPost.dragImages')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('pages.createPost.mediaHint')}
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
              <CardTitle className="text-sm">{t('pages.createPost.publishIn')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {plataformasDisponiveis.map((p) => {
                const Icon = socialIcons[p.value];
                return (
                  <label
                    key={p.value}
                    className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                  >
                    <Checkbox
                      checked={plataformas.includes(p.value)}
                      onCheckedChange={() => togglePlataforma(p.value)}
                    />
                    {Icon && <Icon className={`w-5 h-5 ${p.cor}`} />}
                    <span className="text-sm font-medium">{p.label}</span>
                  </label>
                );
              })}
            </CardContent>
          </Card>

          {/* Ações */}
          <Card className="rounded-xl">
            <CardContent className="p-5 space-y-3">
              <Button className="w-full gap-2" onClick={handlePublicar}>
                <Send className="w-4 h-4" />
                {t('pages.createPost.publishNow')}
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() =>
                  navigate('/preview-post', {
                    state: { titulo, conteudo, plataformas, imagens },
                  })
                }
              >
                <Eye className="w-4 h-4" />
                Preview
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={handleAgendar}>
                <CalendarDays className="w-4 h-4" />
                {t('pages.createPost.schedule')}
              </Button>
              <Button variant="ghost" className="w-full gap-2" onClick={handleSalvarRascunho}>
                <Save className="w-4 h-4" />
                {t('pages.createPost.saveDraft')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
