import type React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Share2, Bookmark, ThumbsUp, Repeat2, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { socialIcons } from '@/components/shared/SocialIcons';
import type { PlataformaSocial } from '@/lib/types';

interface PreviewState {
  titulo: string;
  conteudo: string;
  plataformas: PlataformaSocial[];
  imagens: string[];
}

function InstagramPreview({ conteudo, titulo }: { conteudo: string; titulo: string }) {
  return (
    <div className="max-w-[380px] bg-white dark:bg-gray-950 border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500" />
        <span className="font-bagel text-sm tracking-wider">laurena.studio</span>
      </div>
      {/* Image placeholder */}
      <div className="aspect-square bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-950 dark:to-purple-950 flex items-center justify-center">
        <span className="text-muted-foreground text-sm">{titulo || 'Imagem do post'}</span>
      </div>
      {/* Actions */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Heart className="w-6 h-6 cursor-pointer hover:text-red-500 transition-colors" />
            <MessageCircle className="w-6 h-6 cursor-pointer" />
            <Send className="w-6 h-6 cursor-pointer" />
          </div>
          <Bookmark className="w-6 h-6 cursor-pointer" />
        </div>
        <p className="text-sm font-semibold">1.234 curtidas</p>
        <p className="text-sm">
          <span className="font-bagel tracking-wider">laurena.studio </span>
          {conteudo.slice(0, 200)}
          {conteudo.length > 200 && <span className="text-muted-foreground">...mais</span>}
        </p>
      </div>
    </div>
  );
}

function TwitterPreview({ conteudo }: { conteudo: string }) {
  return (
    <div className="max-w-[500px] bg-white dark:bg-gray-950 border rounded-xl p-4">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 shrink-0" />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bagel tracking-wider text-sm">Laurena Studio</span>
            <span className="text-muted-foreground text-sm">@laurenastudio · 1m</span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{conteudo.slice(0, 280)}</p>
          <div className="flex items-center gap-8 pt-2 text-muted-foreground">
            <div className="flex items-center gap-1 text-xs hover:text-blue-500 cursor-pointer">
              <MessageCircle className="w-4 h-4" /> 12
            </div>
            <div className="flex items-center gap-1 text-xs hover:text-green-500 cursor-pointer">
              <Repeat2 className="w-4 h-4" /> 48
            </div>
            <div className="flex items-center gap-1 text-xs hover:text-red-500 cursor-pointer">
              <Heart className="w-4 h-4" /> 256
            </div>
            <div className="flex items-center gap-1 text-xs hover:text-blue-500 cursor-pointer">
              <Share2 className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkedInPreview({ conteudo, titulo }: { conteudo: string; titulo: string }) {
  return (
    <div className="max-w-[500px] bg-white dark:bg-gray-950 border rounded-xl overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900" />
          <div>
            <p className="font-bagel tracking-wider text-sm">Laurena Studio</p>
            <p className="text-xs text-muted-foreground">Marketing Digital · 1m</p>
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap">{conteudo.slice(0, 500)}</p>
      </div>
      {titulo && (
        <div className="border-t p-4 bg-muted/30">
          <p className="font-semibold text-sm">{titulo}</p>
        </div>
      )}
      <div className="border-t px-4 py-2 flex items-center justify-around text-muted-foreground text-xs">
        <div className="flex items-center gap-1 cursor-pointer hover:text-blue-600">
          <ThumbsUp className="w-4 h-4" /> Gostei
        </div>
        <div className="flex items-center gap-1 cursor-pointer hover:text-blue-600">
          <MessageCircle className="w-4 h-4" /> Comentar
        </div>
        <div className="flex items-center gap-1 cursor-pointer hover:text-blue-600">
          <Repeat2 className="w-4 h-4" /> Republicar
        </div>
        <div className="flex items-center gap-1 cursor-pointer hover:text-blue-600">
          <Send className="w-4 h-4" /> Enviar
        </div>
      </div>
    </div>
  );
}

function FacebookPreview({ conteudo, titulo }: { conteudo: string; titulo: string }) {
  return (
    <div className="max-w-[500px] bg-white dark:bg-gray-950 border rounded-xl overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500" />
          <div>
            <p className="font-bagel tracking-wider text-sm">Laurena Studio</p>
            <p className="text-xs text-muted-foreground">Agora mesmo · 🌐</p>
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap">{conteudo.slice(0, 400)}</p>
      </div>
      {titulo && (
        <div className="aspect-video bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">{titulo}</span>
        </div>
      )}
      <div className="border-t px-4 py-2 flex items-center justify-around text-muted-foreground text-sm">
        <span className="cursor-pointer hover:text-blue-600">👍 Curtir</span>
        <span className="cursor-pointer hover:text-blue-600">💬 Comentar</span>
        <span className="cursor-pointer hover:text-blue-600">↗️ Compartilhar</span>
      </div>
    </div>
  );
}

function TikTokPreview({ conteudo }: { conteudo: string }) {
  return (
    <div className="max-w-[320px] bg-black text-white rounded-xl overflow-hidden relative" style={{ height: 560 }}>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-12 p-4 space-y-2">
        <p className="font-bold text-sm">@laurenastudio</p>
        <p className="text-xs leading-relaxed">{conteudo.slice(0, 150)}</p>
        <p className="text-xs opacity-70">🎵 som original · laurenastudio</p>
      </div>
      <div className="absolute bottom-4 right-3 flex flex-col items-center gap-5">
        <div className="text-center">
          <Heart className="w-7 h-7" />
          <span className="text-[10px]">12.3K</span>
        </div>
        <div className="text-center">
          <MessageCircle className="w-7 h-7" />
          <span className="text-[10px]">432</span>
        </div>
        <div className="text-center">
          <Share2 className="w-7 h-7" />
          <span className="text-[10px]">891</span>
        </div>
      </div>
    </div>
  );
}

function YouTubePreview({ titulo, conteudo }: { titulo: string; conteudo: string }) {
  return (
    <div className="max-w-[500px] bg-white dark:bg-gray-950 border rounded-xl overflow-hidden">
      <div className="aspect-video bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 flex items-center justify-center">
        <div className="w-16 h-12 bg-red-600 rounded-xl flex items-center justify-center">
          <div className="w-0 h-0 border-l-[14px] border-l-white border-y-[8px] border-y-transparent ml-1" />
        </div>
      </div>
      <div className="p-3 space-y-1">
        <p className="font-semibold text-sm line-clamp-2">{titulo || 'Título do vídeo'}</p>
        <p className="text-xs text-muted-foreground">
          <span className="font-bagel tracking-wider">Laurena Studio</span>
          {' '}· 1.2K views · 1 hora atrás
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{conteudo.slice(0, 150)}</p>
      </div>
    </div>
  );
}

const previewComponents: Record<PlataformaSocial, React.FC<{ conteudo: string; titulo: string }>> = {
  instagram: InstagramPreview,
  twitter: TwitterPreview,
  linkedin: LinkedInPreview,
  facebook: FacebookPreview,
  tiktok: TikTokPreview,
  youtube: YouTubePreview,
};

const platformLabels: Record<PlataformaSocial, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'Twitter/X',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

export default function PreviewPost() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as PreviewState) || {
    titulo: '',
    conteudo: '',
    plataformas: [],
    imagens: [],
  };

  const { titulo, conteudo, plataformas } = state;
  const activePlatforms = plataformas.length > 0 ? plataformas : (['instagram'] as PlataformaSocial[]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Preview do Post</h1>
          <p className="text-muted-foreground">
            Veja como seu post aparecerá em cada plataforma.
          </p>
        </div>
      </div>

      {!conteudo && (
        <Card className="rounded-xl">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p>Nenhum conteúdo para visualizar. Volte e crie um post primeiro.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/marketing-ai')}>
              Marketing AI
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {activePlatforms.map((p) => {
          const Icon = socialIcons[p];
          return (
            <Badge key={p} variant="secondary" className="gap-1.5 text-sm py-1 px-3">
              {Icon && <Icon className="w-4 h-4" />}
              {platformLabels[p]}
            </Badge>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {activePlatforms.map((p) => {
          const PreviewComponent = previewComponents[p];
          const Icon = socialIcons[p];
          return (
            <div key={p} className="space-y-3">
              <div className="flex items-center gap-2">
                {Icon && <Icon className="w-5 h-5" />}
                <h2 className="font-semibold">{platformLabels[p]}</h2>
              </div>
              <PreviewComponent conteudo={conteudo} titulo={titulo} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
