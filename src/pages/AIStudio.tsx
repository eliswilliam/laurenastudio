import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import AIInferenceAnimation from '@/components/shared/AIInferenceAnimation';

type StudioMode = null | 'gemini' | 'veo' | 'audio';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'text';
  timestamp: Date;
}

export default function AIStudio() {
  const [mode, setMode] = useState<StudioMode>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating || !mode) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const prompt = input.trim();
    setInput('');
    setIsGenerating(true);

    try {
      if (mode === 'gemini') {
        const { data } = await api.post(
          '/ai/generate',
          { resource_type: 'image', prompt, style: null },
          { timeout: 120000 }
        );

        const isImage = data.content?.startsWith('/uploads/');
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: isImage ? '' : data.content,
          mediaUrl: isImage ? data.content : undefined,
          mediaType: isImage ? 'image' : 'text',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else if (mode === 'veo') {
        const { data } = await api.post(
          '/ai/generate',
          { resource_type: 'video', prompt, style: null },
          { timeout: 600000 }
        );

        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '',
          mediaUrl: data.content,
          mediaType: 'video',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
      toast({ title: 'Conteúdo gerado!', description: 'A IA finalizou a geração.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Erro na geração: ${message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      toast({ title: 'Erro', description: message, variant: 'destructive' });
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
    toast({ title: 'Copiado!' });
  };

  const resetStudio = () => {
    setMode(null);
    setMessages([]);
    setInput('');
    setIsGenerating(false);
  };

  // ── Landing page ───────────────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
        <div className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">AI Studio</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Gere conteúdo de alta qualidade com inteligência artificial. Escolha o tipo de conteúdo abaixo.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Gemini — Image & Text */}
          <button onClick={() => setMode('gemini')} className="group text-left">
            <Card className="rounded-2xl border-2 border-transparent transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/10 cursor-pointer h-full">
              <CardContent className="p-7 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <ImageIcon className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-1">Imagem & Texto</h2>
                  <p className="text-muted-foreground text-sm">
                    Gere textos, imagens e conteúdo criativo em um chat interativo.
                  </p>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  Gemini 2.5
                </Badge>
              </CardContent>
            </Card>
          </button>

          {/* Veo — Video */}
          <button onClick={() => setMode('veo')} className="group text-left">
            <Card className="rounded-2xl border-2 border-transparent transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/10 cursor-pointer h-full">
              <CardContent className="p-7 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <Video className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-1">Vídeo</h2>
                  <p className="text-muted-foreground text-sm">
                    Gere vídeos cinematográficos e criativos com IA generativa.
                  </p>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  Veo 3.1
                </Badge>
              </CardContent>
            </Card>
          </button>

          {/* Audio — Coming Soon */}
          <div className="relative">
            <Card className="rounded-2xl border-2 border-dashed border-muted-foreground/20 h-full opacity-60">
              <CardContent className="p-7 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                  <Music className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-1">Áudio</h2>
                  <p className="text-muted-foreground text-sm">
                    Geração de áudio e trilhas sonoras com IA.
                  </p>
                </div>
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  Em breve
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat interface ─────────────────────────────────────────────────────────
  const modeLabel = mode === 'gemini' ? 'Imagem & Texto' : 'Vídeo';
  const modeModel = mode === 'gemini' ? 'Gemini 2.5' : 'Veo 3.1';

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
              <Sparkles className="w-5 h-5 text-primary" />
              AI Studio — {modeLabel}
            </h1>
            <p className="text-sm text-muted-foreground">Modelo: {modeModel}</p>
          </div>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="w-3 h-3" />
          {modeModel}
        </Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {messages.length === 0 && !isGenerating && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              {mode === 'gemini' ? (
                <ImageIcon className="w-8 h-8 text-primary" />
              ) : (
                <Video className="w-8 h-8 text-primary" />
              )}
            </div>
            <div>
              <p className="font-medium">Comece uma conversa</p>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === 'gemini'
                  ? 'Descreva o que deseja gerar — texto, imagem ou ambos.'
                  : 'Descreva o vídeo que deseja criar.'}
              </p>
            </div>
            {/* Quick suggestions */}
            <div className="flex flex-wrap gap-2 max-w-md justify-center">
              {(mode === 'gemini'
                ? [
                    'Crie uma imagem para post de Instagram sobre café',
                    'Gere um banner para promoção de verão',
                    'Crie uma imagem minimalista de logo tech',
                  ]
                : [
                    'Crie um vídeo de um pôr do sol na praia',
                    'Gere um vídeo de transição suave de produto',
                    'Crie um vídeo cinematográfico urbano',
                  ]
              ).map((suggestion) => (
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
                        Baixar
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
                      Baixar
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
                  Copiar
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
              <AIInferenceAnimation type={mode === 'veo' ? 'video' : 'image'} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t pt-4 shrink-0">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              placeholder={
                mode === 'gemini'
                  ? 'Descreva o que deseja gerar…'
                  : 'Descreva o vídeo que deseja criar…'
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
            disabled={!input.trim() || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {mode === 'gemini'
            ? 'Gemini 2.5 — gera texto e imagens com base no seu prompt.'
            : 'Veo 3.1 — a geração de vídeo pode levar até 5 minutos.'}
        </p>
      </div>
    </div>
  );
}
