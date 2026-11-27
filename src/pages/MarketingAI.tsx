import { useState, useRef, useCallback, useEffect } from 'react';
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
  BrainCircuit,
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
import api, { formatApiError, getAiVideoJobStatus } from '@/lib/api';
import AIInferenceAnimation from '@/components/shared/AIInferenceAnimation';
import { useTranslation } from '@/hooks/useTranslation';
import {
  FacebookIcon,
  InstagramIcon,
  ThreadsIcon,
  TwitterIcon,
  WhatsAppIcon,
  TikTokIcon,
  YouTubeIcon,
} from '@/components/shared/SocialIcons';

/** Cores oficiais / reconhecíveis por rede — ícones sempre legíveis. */
const shareChannels = [
  {
    key: 'facebook',
    Icon: FacebookIcon,
    label: 'Facebook',
    btnClass:
      'border-[#1877F2]/45 bg-[#1877F2]/12 text-[#1877F2] hover:bg-[#1877F2]/22 shadow-sm shadow-[#1877F2]/10',
  },
  {
    key: 'instagram',
    Icon: InstagramIcon,
    label: 'Instagram',
    btnClass:
      'border-pink-500/40 bg-gradient-to-br from-[#f58529]/20 via-[#dd2a7b]/20 to-[#8134af]/25 text-pink-600 dark:text-pink-400 hover:from-[#f58529]/30 hover:via-[#dd2a7b]/30 hover:to-[#8134af]/35',
  },
  {
    key: 'threads',
    Icon: ThreadsIcon,
    label: 'Threads',
    btnClass: 'border-zinc-400/50 bg-zinc-900/[0.08] text-zinc-900 dark:text-zinc-100 hover:bg-zinc-900/15 dark:hover:bg-zinc-100/10',
  },
  {
    key: 'twitter',
    Icon: TwitterIcon,
    label: 'X',
    btnClass: 'border-zinc-800/40 bg-zinc-950/[0.08] text-zinc-900 dark:text-zinc-50 hover:bg-zinc-950/18',
  },
  {
    key: 'whatsapp',
    Icon: WhatsAppIcon,
    label: 'WhatsApp',
    btnClass:
      'border-[#25D366]/45 bg-[#25D366]/12 text-[#128C7E] dark:text-[#25D366] hover:bg-[#25D366]/22',
  },
  {
    key: 'tiktok',
    Icon: TikTokIcon,
    label: 'TikTok',
    btnClass:
      'border-cyan-500/35 bg-black/80 text-white hover:bg-black hover:border-[#FE2C55]/50 ring-1 ring-inset ring-white/5',
  },
  {
    key: 'youtube',
    Icon: YouTubeIcon,
    label: 'YouTube',
    btnClass: 'border-[#FF0000]/45 bg-[#FF0000]/12 text-[#FF0000] hover:bg-[#FF0000]/20',
  },
] as const;

export default function MarketingAI() {
  const { t } = useTranslation();
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

  useEffect(() => {
    resetFormStore();
    setReferenceImage(null);
    setReferencePreview(null);
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [resetFormStore]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: t('pages.marketingAI.toastInvalidFormat'),
        description: t('pages.marketingAI.toastInvalidFormatDesc'),
        variant: 'destructive',
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t('pages.marketingAI.toastFileTooBig'),
        description: t('pages.marketingAI.toastFileTooBigDesc'),
        variant: 'destructive',
      });
      return;
    }
    setReferenceMime(file.type);
    setReferencePreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => setReferenceImage((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  }, [toast, t]);

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
      } else {
        const res = await api.post<{ jobId?: string }>(
          '/marketing/generate-video',
          {
            brand_name: brandName,
            ad_text: adText,
            prompt: prompt || undefined,
            video_mode: videoMode,
            reference_image_b64: videoMode === 'image_to_video' ? (referenceImage || undefined) : undefined,
            reference_mime: referenceMime,
          },
          { timeout: 120000, validateStatus: (s) => s === 202 }
        );
        const jobId = res.data.jobId;
        if (!jobId) throw new Error(t('pages.marketingAI.errorNoJobId'));

        const maxWaitMs = 15 * 60 * 1000;
        const started = Date.now();
        let data: MarketingVideoResult | null = null;
        while (Date.now() - started < maxWaitMs) {
          const j = await getAiVideoJobStatus(jobId);
          if (j.status === 'success' && j.result) {
            const r = j.result as Record<string, unknown>;
            data = {
              video_url: String(r.video_url ?? ''),
              usage_after: Number(r.usage_after ?? 0),
              limit: Number(r.limit ?? 0),
              message: String(r.message ?? t('pages.marketingAI.defaultVideoSuccess')),
            };
            break;
          }
          if (j.status === 'failed') {
            throw new Error(j.error || t('pages.marketingAI.errorVideoGen'));
          }
          await new Promise((r) => setTimeout(r, 2500));
        }
        if (!data) throw new Error(t('pages.marketingAI.errorVideoTimeout'));
        setVideoResult(data);
      }
    } catch (err: unknown) {
      toast({ title: t('pages.marketingAI.toastGenError'), description: formatApiError(err), variant: 'destructive' });
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
      const label = shareChannels.find((c) => c.key === channel)?.label ?? channel;
      navigator.clipboard.writeText(`${text}\n${url}`);
      toast({
        title: t('pages.marketingAI.linkCopied'),
        description: t('pages.marketingAI.linkCopiedDesc', { channel: label }),
      });
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
          <h1 className="text-3xl font-bold">{t('nav.marketingAI')}</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">{t('pages.marketingAI.heroSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <button onClick={() => setSelectedType('image')} className="group text-left">
            <Card className="rounded-2xl border-2 border-transparent transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/10 cursor-pointer h-full">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <ImageIcon className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2">{t('pages.marketingAI.pickImageTitle')}</h2>
                  <p className="text-muted-foreground text-sm">{t('pages.marketingAI.pickImageDesc')}</p>
                </div>
                <div className="flex items-center gap-1.5 text-primary text-sm font-medium">
                  <BrainCircuit className="w-4 h-4" />
                  {t('pages.marketingAI.pickImageModel')}
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
                  <h2 className="text-xl font-bold mb-2">{t('pages.marketingAI.pickVideoTitle')}</h2>
                  <p className="text-muted-foreground text-sm">{t('pages.marketingAI.pickVideoDesc')}</p>
                </div>
                <div className="flex items-center gap-1.5 text-primary text-sm font-medium">
                  <BrainCircuit className="w-4 h-4" />
                  {t('pages.marketingAI.pickVideoModel')}
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
            {selectedType === 'image' ? t('pages.marketingAI.formTitleImage') : t('pages.marketingAI.formTitleVideo')}
          </h1>
          <p className="text-muted-foreground">
            {selectedType === 'image' ? t('pages.marketingAI.formSubImage') : t('pages.marketingAI.formSubVideo')}
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
                  <Label>{t('pages.marketingAI.videoModeLabel')}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setVideoMode('text_to_video')}
                      disabled={loading}
                      className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
                        videoMode === 'text_to_video'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <FileVideo className={`w-5 h-5 shrink-0 ${videoMode === 'text_to_video' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t('pages.marketingAI.textToVideoTitle')}</p>
                        <p className="text-xs text-muted-foreground">{t('pages.marketingAI.textToVideoDesc')}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoMode('image_to_video')}
                      disabled={loading}
                      className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
                        videoMode === 'image_to_video'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <FileImage className={`w-5 h-5 shrink-0 ${videoMode === 'image_to_video' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t('pages.marketingAI.imageToVideoTitle')}</p>
                        <p className="text-xs text-muted-foreground">{t('pages.marketingAI.imageToVideoDesc')}</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="brand">{t('pages.marketingAI.brandLabel')}</Label>
                <Input
                  id="brand"
                  placeholder={t('pages.marketingAI.brandPlaceholder')}
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adText">{t('pages.marketingAI.adTextLabel')}</Label>
                <Textarea
                  id="adText"
                  placeholder={t('pages.marketingAI.adTextPlaceholder')}
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
                      ? t('pages.marketingAI.refOrigin')
                      : t('pages.marketingAI.refReference')}
                    {selectedType === 'image' && (
                      <span className="text-muted-foreground font-normal ml-1">{t('pages.marketingAI.optional')}</span>
                    )}
                  </Label>
                  {referencePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={referencePreview}
                        alt={t('pages.marketingAI.altReference')}
                        className="w-40 h-40 object-cover rounded-xl border"
                      />
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
                      <p className="text-sm text-muted-foreground">{t('pages.marketingAI.uploadHint')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('pages.marketingAI.uploadFormats')}</p>
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
                  {selectedType === 'image' ? t('pages.marketingAI.promptImage') : t('pages.marketingAI.promptVideo')}{' '}
                  <span className="text-muted-foreground font-normal">{t('pages.marketingAI.optional')}</span>
                </Label>
                <Textarea
                  id="prompt"
                  placeholder={
                    selectedType === 'image'
                      ? t('pages.marketingAI.promptPlaceholderImage')
                      : t('pages.marketingAI.promptPlaceholderVideo')
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
                <BrainCircuit className="w-5 h-5" />
                {selectedType === 'image' ? t('pages.marketingAI.generateImage') : t('pages.marketingAI.generateVideo')}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Result panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-xl min-h-[400px] flex flex-col">
            <CardContent className="p-6 flex-1 flex flex-col">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
                {t('pages.marketingAI.resultTitle')}
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
                  <p className="text-sm text-muted-foreground">{t('pages.marketingAI.emptyResult')}</p>
                </div>
              )}

              {/* Image result */}
              {imageResult && imageResult.image_url && (
                <div className="space-y-4">
                  <img
                    src={`${backendBase}${imageResult.image_url}`}
                    alt={t('pages.marketingAI.altAd')}
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
                  <p className="text-xs text-muted-foreground">{t('pages.marketingAI.aiTextInstead')}</p>
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
                      {imageResult ? t('pages.marketingAI.downloadImage') : t('pages.marketingAI.downloadVideo')}
                    </Button>
                  </a>

                  {/* Share */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Share2 className="w-4 h-4" />
                      {t('pages.marketingAI.share')}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {shareChannels.map(({ key, Icon, label, btnClass }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleShare(key)}
                          title={label}
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${btnClass}`}
                        >
                          <Icon className="w-5 h-5" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Edit */}
                  <Button variant="secondary" className="w-full gap-2" onClick={handleEdit}>
                    <Pencil className="w-4 h-4" />
                    {t('pages.marketingAI.editInStudio')}
                  </Button>

                  {/* Usage */}
                  <p className="text-xs text-muted-foreground text-center">
                    {t('pages.marketingAI.usage', {
                      used: imageResult ? imageResult.usage_after : videoResult?.usage_after ?? 0,
                      limit:
                        (imageResult ? imageResult.limit : videoResult?.limit) === 0
                          ? '∞'
                          : String(imageResult ? imageResult.limit : videoResult?.limit ?? 0),
                    })}
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
