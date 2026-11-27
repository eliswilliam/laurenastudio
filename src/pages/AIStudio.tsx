import { useState, useRef, useEffect, useMemo } from 'react';
import { useAIStudioStore, type StudioChatMessage, type StudioMode } from '@/store/useAIStudioStore';
import {
  BrainCircuit,
  ImageIcon,
  Video,
  Music,
  ArrowLeft,
  Send,
  Download,
  Copy,
  User,
  Bot,
  Loader2,
  Paperclip,
  X
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import api, { formatApiError, getAiVideoJobStatus } from '@/lib/api';
import AIInferenceAnimation from '@/components/shared/AIInferenceAnimation';
import { useTranslation } from '@/hooks/useTranslation';

/** Rótulos exibidos na UI. */
const STUDIO_LABEL_IMAGE_MODEL = 'Gemini 2.5 Flash';
const STUDIO_LABEL_VIDEO_MODEL = 'veo3';
/** Model ID sent to the backend for image generation (Vertex AI via /ai/generate). */
const STUDIO_IMAGE_MODEL_ID = 'gemini-2.5-flash-image';

export default function AIStudio() {
  const { t } = useTranslation();
  const mode = useAIStudioStore((s) => s.mode);
  const setMode = useAIStudioStore((s) => s.setMode);
  const messages = useAIStudioStore((s) => s.messages);
  const setMessages = useAIStudioStore((s) => s.setMessages);
  const input = useAIStudioStore((s) => s.input);
  const setInput = useAIStudioStore((s) => s.setInput);
  const resetStudioStore = useAIStudioStore((s) => s.resetStudio);

  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [referenceImage, setReferenceImage] = useState<string>('');
  const [referencePreview, setReferencePreview] = useState<string>('');
  const [referenceMime, setReferenceMime] = useState<string>('image/png');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        toast({
          title: t('pages.aiStudio.toastInvalidImage'),
          description: t('pages.aiStudio.toastInvalidImageDesc'),
          variant: 'destructive',
        });
        return;
    }
    setReferenceMime(file.type);
    setReferencePreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => setReferenceImage((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = () => {
      setReferencePreview('');
      setReferenceImage('');
  };

  useEffect(() => {
    resetStudioStore();
    setIsGenerating(false);
    setReferenceImage('');
    setReferencePreview('');
    setReferenceMime('image/png');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [resetStudioStore]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const ts = () => new Date().toISOString();

  const handleSend = async () => {
    if (!input.trim() && !referenceImage) return;
    if (isGenerating || !mode) return;

    if (mode === 'video' && !referenceImage) {
        toast({
          title: t('pages.aiStudio.toastImageRequired'),
          description: t('pages.aiStudio.toastImageRequiredDesc'),
          variant: 'destructive',
        });
        return;
    }

    const userMsg: StudioChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: ts(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const prompt = input.trim();
    setInput('');
    setIsGenerating(true);

    try {
      if (mode === 'image') {
        const { data } = await api.post(
          '/ai/generate',
          { resource_type: 'image', prompt, model: STUDIO_IMAGE_MODEL_ID, style: null },
          { timeout: 120000 }
        );

        const isImage = data.content?.startsWith('/uploads/');
        const assistantMsg: StudioChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: isImage ? '' : data.content,
          mediaUrl: isImage ? data.content : undefined,
          mediaType: isImage ? 'image' : 'text',
          timestamp: ts(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else if (mode === 'video') {
        const res = await api.post<{
          jobId?: string;
          content?: string;
        }>(
          '/ai/generate',
          { resource_type: 'video', prompt, model: 'hailuo-2.3-fast', style: null, reference_image_b64: referenceImage, reference_mime: referenceMime },
          { timeout: 120000, validateStatus: (s) => s === 200 || s === 202 }    
        );

        let videoUrl = '';

        if (res.status === 202 && res.data.jobId) {
          const jobId = res.data.jobId;
          const maxWaitMs = 15 * 60 * 1000;
          const started = Date.now();
          while (Date.now() - started < maxWaitMs) {
            const j = await getAiVideoJobStatus(jobId);
            if (j.status === 'success' && j.result) {
              videoUrl = String((j.result as Record<string, unknown>).content ?? '');
              if (!videoUrl) throw new Error(t('pages.aiStudio.errorVideoNoUrl'));
              break;
            }
            if (j.status === 'failed') {
              throw new Error(j.error || t('pages.aiStudio.errorGenFailed'));
            }
            await new Promise((r) => setTimeout(r, 2500));
          }
          if (!videoUrl) {
            throw new Error(t('pages.aiStudio.errorVideoTimeout'));
          }
        } else if (res.status === 200 && res.data.content) {
          videoUrl = res.data.content;
        } else {
          throw new Error(t('pages.aiStudio.errorVideoUnexpected'));
        }

        const assistantMsg: StudioChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '',
          mediaUrl: videoUrl,
          mediaType: 'video',
          timestamp: ts(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else if (mode === 'audio') {
        const { data } = await api.post<{ content?: string }>(
          '/ai/generate',
          { resource_type: 'audio', prompt, style: null, model: 'azure' },
          { timeout: 120000 }
        );
        const audioPath = data.content?.trim();
        if (!audioPath || !audioPath.startsWith('/uploads/')) {
          throw new Error(t('pages.aiStudio.errorAudioInvalid'));
        }
        const assistantMsg: StudioChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '',
          mediaUrl: audioPath,
          mediaType: 'audio',
          timestamp: ts(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err: unknown) {
      const message = formatApiError(err);
      const errorMsg: StudioChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: t('pages.aiStudio.generationError'),
        timestamp: ts(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      toast({ title: t('pages.aiStudio.toastError'), description: message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t('pages.aiStudio.copied') });
  };

  const resetStudio = () => {
    resetStudioStore();
    setIsGenerating(false);
  };

  const suggestionList = useMemo((): string[] => {
    if (!mode) return [];
    if (mode === 'image') {
      return t('pages.aiStudio.suggestions.image', { returnObjects: true }) as string[];
    }
    if (mode === 'video') {
      return t('pages.aiStudio.suggestions.video', { returnObjects: true }) as string[];
    }
    return t('pages.aiStudio.suggestions.audio', { returnObjects: true }) as string[];
  }, [mode, t]);

  // Landing page
  if (!mode) {
    return (
      <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
        <div className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <BrainCircuit className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">{t('nav.aiStudio')}</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">{t('pages.aiStudio.landingSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Image */}
          <button onClick={() => setMode("image")} className="group text-left">
            <Card className="rounded-2xl border-2 border-transparent transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/10 cursor-pointer h-full">
              <CardContent className="p-7 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <ImageIcon className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-1">{t('pages.aiStudio.cardImageTitle')}</h2>
                  <p className="text-muted-foreground text-sm">{t('pages.aiStudio.cardImageDesc')}</p>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <BrainCircuit className="w-3 h-3" />
                  {STUDIO_LABEL_IMAGE_MODEL}
                </Badge>
              </CardContent>
            </Card>
          </button>

          {/* Video */}
          <button onClick={() => setMode("video")} className="group text-left">
            <Card className="rounded-2xl border-2 border-transparent transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/10 cursor-pointer h-full">
              <CardContent className="p-7 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <Video className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-1">{t('pages.aiStudio.cardVideoTitle')}</h2>
                  <p className="text-muted-foreground text-sm">{t('pages.aiStudio.cardVideoDesc')}</p>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <BrainCircuit className="w-3 h-3" />
                  {STUDIO_LABEL_VIDEO_MODEL}
                </Badge>
              </CardContent>
            </Card>
          </button>

          {/* Audio: Azure TTS */}
          <button type="button" onClick={() => setMode("audio")} className="group text-left">
            <Card className="rounded-2xl border-2 border-transparent transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/10 cursor-pointer h-full">
              <CardContent className="p-7 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <Music className="w-8 h-8 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-1">{t('pages.aiStudio.cardAudioTitle')}</h2>
                  <p className="text-muted-foreground text-sm">{t('pages.aiStudio.cardAudioDesc')}</p>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Music className="w-3 h-3" />
                  {t('pages.aiStudio.badgeAzureSpeech')}
                </Badge>
              </CardContent>
            </Card>
          </button>
        </div>
      </div>
    );
  }

  // Chat interface
  const modeLabel =
    mode === 'image'
      ? t('pages.aiStudio.cardImageTitle')
      : mode === 'video'
        ? t('pages.aiStudio.cardVideoTitle')
        : t('pages.aiStudio.cardAudioTitle');
  const modeModel =
    mode === 'image'
      ? STUDIO_LABEL_IMAGE_MODEL
      : mode === 'video'
        ? STUDIO_LABEL_VIDEO_MODEL
        : t('pages.aiStudio.labelAudioModel');

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={resetStudio}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-primary" />
              {t('pages.aiStudio.headerSuffix', { mode: modeLabel })}
            </h1>
            <p className="text-sm text-muted-foreground">{t('pages.aiStudio.modelLine', { model: modeModel })}</p>
          </div>
        </div>
        <Badge variant="secondary" className="gap-1">
          <BrainCircuit className="w-3 h-3" />
          {modeModel}
        </Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {messages.length === 0 && !isGenerating && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              {mode === 'image' ? (
                <ImageIcon className="w-8 h-8 text-primary" />
              ) : mode === 'video' ? (
                <Video className="w-8 h-8 text-primary" />
              ) : (
                <Music className="w-8 h-8 text-violet-600" />
              )}
            </div>
            <div>
              <p className="font-medium">{t('pages.aiStudio.emptyChatTitle')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === 'image'
                  ? t('pages.aiStudio.emptyChatHintImage')
                  : mode === 'video'
                    ? t('pages.aiStudio.emptyChatHintVideo')
                    : t('pages.aiStudio.emptyChatHintAudio')}
              </p>
            </div>
            {/* Quick suggestions */}
            <div className="flex flex-wrap gap-2 max-w-md justify-center">
              {suggestionList.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-1.5 rounded-full border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}

            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-card border rounded-bl-md'
              }`}
            >
              {msg.content && (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}

              {msg.mediaUrl && msg.mediaType === 'image' && (
                <div className="mt-2 space-y-2">
                  <img
                    src={msg.mediaUrl}
                    alt="Generated"
                    className="rounded-xl max-w-full border"
                  />
                  <div className="flex gap-2">
                    <a href={msg.mediaUrl} download target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs">
                        <Download className="w-3 h-3" />
                        {t('pages.aiStudio.download')}
                      </Button>
                    </a>
                  </div>
                </div>
              )}

              {msg.mediaUrl && msg.mediaType === 'video' && (
                <div className="mt-2 space-y-2">
                  <video src={msg.mediaUrl} controls className="rounded-xl max-w-full border" />
                  <a href={msg.mediaUrl} download target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs">
                      <Download className="w-3 h-3" />
                      {t('pages.aiStudio.download')}
                    </Button>
                  </a>
                </div>
              )}

              {msg.mediaUrl && msg.mediaType === 'audio' && (
                <div className="mt-2 space-y-2">
                  <audio src={msg.mediaUrl} controls className="rounded-xl w-full max-w-md" />
                  <a
                    href={msg.mediaUrl}
                    download="laurena-speech.wav"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs">
                      <Download className="w-3 h-3" />
                      {t('pages.aiStudio.downloadWav')}
                    </Button>
                  </a>
                </div>
              )}

              {msg.role === 'assistant' && msg.content && !msg.mediaUrl && (
                <button
                  onClick={() => handleCopy(msg.content)}
                  className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  {t('pages.aiStudio.copy')}
                </button>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}

        {/* AI inference animation during generation */}
        {isGenerating && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-card border rounded-2xl rounded-bl-md px-4 py-3 max-w-[75%]">
              <AIInferenceAnimation
                type={mode === 'video' ? 'video' : mode === 'audio' ? 'audio' : 'image'}
              />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t pt-4 shrink-0">

        {referencePreview && (
          <div className="mb-3 relative inline-block">
             <img src={referencePreview} className="h-20 w-20 object-cover rounded-xl border border-border" alt="reference" />
             <button onClick={removeImage} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"><X className="w-3 h-3" /></button>
          </div>
        )}

        <div className="flex gap-3 items-end">
          {mode === 'video' && (
            <div className="shrink-0 flex items-center justify-center">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
              <Button type="button" variant="outline" size="icon" className="h-12 w-12 rounded-xl" onClick={() => fileInputRef.current?.click()} disabled={isGenerating}>
                <Paperclip className="h-5 w-5" />
              </Button>
            </div>
          )}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              placeholder={
                mode === 'image'
                  ? t('pages.aiStudio.placeholderImage')
                  : mode === 'video'
                    ? t('pages.aiStudio.placeholderVideo')
                    : t('pages.aiStudio.placeholderAudio')
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[48px] max-h-[150px] resize-none pr-12"
              disabled={isGenerating}
            />
          </div>
          <Button
            size="icon"
            className="h-12 w-12 shrink-0 rounded-xl"
            onClick={handleSend}
            disabled={(!input.trim() && !referenceImage) || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {mode === 'image'
            ? t('pages.aiStudio.footerImage', { model: STUDIO_LABEL_IMAGE_MODEL })
            : mode === 'video'
              ? t('pages.aiStudio.footerVideo', { model: STUDIO_LABEL_VIDEO_MODEL })
              : t('pages.aiStudio.footerAudio')}
        </p>
      </div>
    </div>
  );
}
