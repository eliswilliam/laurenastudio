import { useState, useRef, useCallback } from 'react';
import {
  useMarketingAIStore,
  type MarketingImageResult,
  type MarketingVideoResult,
} from '@/store/useMarketingAIStore';
import {
  Megaphone,
  ImageIcon,
  Video,
  Upload,
  X,
  Sparkles,
  Download,
  ArrowLeft,
  Pencil,
  Share2,
  FileVideo,
  FileImage,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import AIInferenceAnimation from '@/components/shared/AIInferenceAnimation';
import {
  FacebookIcon,
  InstagramIcon,
  ThreadsIcon,
  TwitterIcon,
  WhatsAppIcon,
  TikTokIcon,
  YouTubeIcon,
} from '@/components/shared/SocialIcons';

const shareChannels = [
  { key: 'facebook', Icon: FacebookIcon, label: 'Facebook', color: 'hover:text-blue-600' },
  { key: 'instagram', Icon: InstagramIcon, label: 'Instagram', color: 'hover:text-pink-500' },
  { key: 'threads', Icon: ThreadsIcon, label: 'Threads', color: 'hover:text-foreground' },
  { key: 'twitter', Icon: TwitterIcon, label: 'X', color: 'hover:text-foreground' },
  { key: 'whatsapp', Icon: WhatsAppIcon, label: 'WhatsApp', color: 'hover:text-green-500' },
  { key: 'tiktok', Icon: TikTokIcon, label: 'TikTok', color: 'hover:text-foreground' },
  { key: 'youtube', Icon: YouTubeIcon, label: 'YouTube', color: 'hover:text-red-600' },
] as const;

export default function MarketingAI() {
  const selectedType = useMarketingAIStore((s) => s.selectedType);
  const setSelectedType = useMarketingAIStore((s) => s.setSelectedType);
  const videoMode = useMarketingAIStore((s) => s.videoMode);
  const setVideoMode = useMarketingAIStore((s) => s.setVideoMode);
  const brandName = useMarketingAIStore((s) => s.brandName);
  const setBrandName = useMarketingAIStore((s) => s.setBrandName);
  const adText = useMarketingAIStore((s) => s.adText);
  const setAdText = useMarketingAIStore((s) => s.setAdText);
  const prompt = useMarketingAIStore((s) => s.prompt);
  const setPrompt = useMarketingAIStore((s) => s.setPrompt);
  const referenceMime = useMarketingAIStore((s) => s.referenceMime);
  const setReferenceMime = useMarketingAIStore((s) => s.setReferenceMime);
  const imageResult = useMarketingAIStore((s) => s.imageResult);
  const setImageResult = useMarketingAIStore((s) => s.setImageResult);
  const videoResult = useMarketingAIStore((s) => s.videoResult);
  const setVideoResult = useMarketingAIStore((s) => s.setVideoResult);
  const resetFormStore = useMarketingAIStore((s) => s.resetForm);

  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Formato inválido', description: 'Envie uma imagem (PNG, JPG, WebP).', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo 10 MB.', variant: 'destructive' });
      return;
    }
    setReferenceMime(file.type);
    setReferencePreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => setReferenceImage((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const removeImage = () => {
    setReferenceImage(null);
    setReferencePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!brandName.trim() || !adText.trim() || !selectedType) return;

    setLoading(true);
    setImageResult(null);
    setVideoResult(null);

    try {
      if (selectedType === 'image') {
        const { data } = await api.post<MarketingImageResult>(
          '/marketing/generate-image',
          {
            brand_name: brandName,
            ad_text: adText,
            prompt: prompt || undefined,
            reference_image_b64: referenceImage || undefined,
            reference_mime: referenceMime,
          },
          { timeout: 120000 }
        );
        setImageResult(data);
        toast({ title: 'Imagem gerada!', description: data.message });
      } else {
        const { data } = await api.post<MarketingVideoResult>(
          '/marketing/generate-video',
          {
            brand_name: brandName,
            ad_text: adText,
            prompt: prompt || undefined,
            video_mode: videoMode,
            reference_image_b64: videoMode === 'image_to_video' ? (referenceImage || undefined) : undefined,
            reference_mime: referenceMime,
          },
          { timeout: 360000 }
        );
        setVideoResult(data);
        toast({ title: 'Vídeo gerado!', description: data.message });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro na geração', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    resetFormStore();
    removeImage();
  };

  const backendBase = api.defaults.baseURL?.replace('/api/v1', '') || '';

  const getContentUrl = () => {
    if (imageResult?.image_url) return `${backendBase}${imageResult.image_url}`;
    if (videoResult?.video_url) return `${backendBase}${videoResult.video_url}`;
    return '';
  };

  const handleShare = (channel: string) => {
    const url = getContentUrl();
    const text = `${brandName}: ${adText}`;
    const encoded = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(url);

    const shareUrls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encoded}`,
      whatsapp: `https://api.whatsapp.com/send?text=${encoded}%20${encodedUrl}`,
      threads: `https://www.threads.net/intent/post?text=${encoded}%20${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    };

    if (shareUrls[channel]) {
      window.open(shareUrls[channel], '_blank', 'width=600,height=500');
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`);
      toast({ title: 'Link copiado!', description: `Conteúdo copiado para compartilhar no ${channel}.` });
    }
  };

  const handleEdit = () => {
    const url = getContentUrl();
    const type = imageResult ? 'image' : 'video';
    navigate('/editor', { state: { mediaUrl: url, mediaType: type } });
  };

  const hasResult = !!(imageResult?.image_url || videoResult);

  // ── Type selection screen ──────────────────────────────────────────────────
  if (!selectedType) {
    return (
      <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
        <div className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <Megaphone className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Marketing AI</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Utilize a Laurena AI para criar imagens e vídeos publicitários para sua empresa em poucos minutos.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <button onClick={() => setSelectedType('image')} className="group text-left">
            <Card className="rounded-2xl border-2 border-transparent transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/10 cursor-pointer h-full">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <ImageIcon className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2">Gerar Imagem</h2>
                  <p className="text-muted-foreground text-sm">
                    Crie imagens publicitárias profissionais com IA. Envie sua foto ou deixe a IA gerar automaticamente.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-primary text-sm font-medium">
                  <Sparkles className="w-4 h-4" />
                  Gemini 2.5
                </div>
              </CardContent>
            </Card>
          </button>

          <button onClick={() => setSelectedType('video')} className="group text-left">
            <Card className="rounded-2xl border-2 border-transparent transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/10 cursor-pointer h-full">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <Video className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2">Gerar Vídeo</h2>
                  <p className="text-muted-foreground text-sm">
                    Crie vídeos publicitários dinâmicos com IA. Ideal para stories, reels e anúncios em vídeo.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-primary text-sm font-medium">
                  <Sparkles className="w-4 h-4" />
                  Veo 3
                </div>
              </CardContent>
            </Card>
          </button>
        </div>
      </div>
    );
  }

  // ── Generation form ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={resetForm} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {selectedType === 'image' ? (
              <ImageIcon className="w-6 h-6 text-primary" />
            ) : (
              <Video className="w-6 h-6 text-primary" />
            )}
            {selectedType === 'image' ? 'Gerar Imagem Publicitária' : 'Gerar Vídeo Publicitário'}
          </h1>
          <p className="text-muted-foreground">
            {selectedType === 'image'
              ? 'Preencha os dados e a IA criará uma imagem profissional para seu anúncio.'
              : 'Preencha os dados e a IA criará um vídeo dinâmico para seu anúncio.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="rounded-xl">
            <CardContent className="p-6 space-y-5">
              {/* Video mode selector */}
              {selectedType === 'video' && (
                <div className="space-y-2">
                  <Label>Modo de Geração</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setVideoMode('text_to_video')}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        videoMode === 'text_to_video'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <FileVideo className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Texto → Vídeo</p>
                        <p className="text-xs text-muted-foreground">Gerar vídeo a partir de texto</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setVideoMode('image_to_video')}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        videoMode === 'image_to_video'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <FileImage className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Imagem → Vídeo</p>
                        <p className="text-xs text-muted-foreground">Animar uma imagem em vídeo</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="brand">Nome da Marca *</Label>
                <Input
                  id="brand"
                  placeholder="Ex: Laurena Studio"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adText">Texto da Publicidade *</Label>
                <Textarea
                  id="adText"
                  placeholder="Ex: Transforme sua presença digital com ferramentas de IA"
                  className="min-h-[100px] resize-none"
                  value={adText}
                  onChange={(e) => setAdText(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground text-right">{adText.length}/2000</p>
              </div>

              {/* Image upload: image type and image_to_video mode */}
              {(selectedType === 'image' || videoMode === 'image_to_video') && (
                <div className="space-y-2">
                  <Label>
                    {selectedType === 'video' && videoMode === 'image_to_video'
                      ? 'Imagem de Origem *'
                      : 'Imagem de Referência'}
                    {selectedType === 'image' && (
                      <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
                    )}
                  </Label>
                  {referencePreview ? (
                    <div className="relative inline-block">
                      <img src={referencePreview} alt="Referência" className="w-40 h-40 object-cover rounded-xl border" />
                      <button
                        onClick={removeImage}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                    >
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Arraste uma imagem ou clique para upload</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP até 10MB</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="prompt">
                  {selectedType === 'image' ? 'Prompt da Imagem' : 'Prompt do Vídeo'}{' '}
                  <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Textarea
                  id="prompt"
                  placeholder={
                    selectedType === 'image'
                      ? 'Descreva a imagem que deseja…'
                      : 'Descreva o vídeo que deseja…'
                  }
                  className="min-h-[80px] resize-none"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={loading}
                />
              </div>

              <Button
                className="w-full gap-2 h-12 text-base"
                onClick={handleGenerate}
                disabled={loading || !brandName.trim() || !adText.trim()}
              >
                <Sparkles className="w-5 h-5" />
                {selectedType === 'image' ? 'Gerar Imagem Publicitária' : 'Gerar Vídeo Publicitário'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Result panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-xl min-h-[400px] flex flex-col">
            <CardContent className="p-6 flex-1 flex flex-col">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
                Resultado
              </h3>

              {/* AI inference animation */}
              {loading && <AIInferenceAnimation type={selectedType === 'video' ? 'video' : 'image'} />}

              {/* Empty state */}
              {!loading && !hasResult && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                    {selectedType === 'image' ? (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    ) : (
                      <Video className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">O resultado aparecerá aqui após a geração.</p>
                </div>
              )}

              {/* Image result */}
              {imageResult && imageResult.image_url && (
                <div className="space-y-4">
                  <img
                    src={`${backendBase}${imageResult.image_url}`}
                    alt="Anúncio gerado"
                    className="w-full rounded-xl border shadow-sm"
                  />
                  {imageResult.ai_text && (
                    <p className="text-sm text-muted-foreground">{imageResult.ai_text}</p>
                  )}
                </div>
              )}

              {imageResult && !imageResult.image_url && imageResult.ai_text && (
                <div className="space-y-3">
                  <p className="text-sm">{imageResult.ai_text}</p>
                  <p className="text-xs text-muted-foreground">A IA retornou texto em vez de imagem. Tente ajustar o prompt.</p>
                </div>
              )}

              {/* Video result */}
              {videoResult && (
                <div className="space-y-4">
                  <video
                    src={`${backendBase}${videoResult.video_url}`}
                    controls
                    className="w-full rounded-xl border shadow-sm"
                  />
                </div>
              )}

              {/* Actions: Download + Share + Edit */}
              {hasResult && (
                <div className="mt-6 space-y-4 border-t pt-4">
                  {/* Download */}
                  <a href={getContentUrl()} download target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full gap-2">
                      <Download className="w-4 h-4" />
                      {imageResult ? 'Baixar Imagem' : 'Baixar Vídeo'}
                    </Button>
                  </a>

                  {/* Share */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Share2 className="w-4 h-4" />
                      Compartilhar
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {shareChannels.map(({ key, Icon, label, color }) => (
                        <button
                          key={key}
                          onClick={() => handleShare(key)}
                          title={label}
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center text-muted-foreground transition-colors ${color} hover:border-primary/40 hover:bg-primary/5`}
                        >
                          <Icon className="w-4.5 h-4.5" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Edit */}
                  <Button variant="secondary" className="w-full gap-2" onClick={handleEdit}>
                    <Pencil className="w-4 h-4" />
                    Editar no Studio
                  </Button>

                  {/* Usage */}
                  <p className="text-xs text-muted-foreground text-center">
                    Uso: {imageResult ? imageResult.usage_after : videoResult?.usage_after}/
                    {(imageResult ? imageResult.limit : videoResult?.limit) === 0
                      ? '∞'
                      : imageResult ? imageResult.limit : videoResult?.limit}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
