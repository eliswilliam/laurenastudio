/**
 * HeroInferenceDemo.tsx
 * Simula uma inferência de IA em tempo real: texto que digita, processa e termina com imagem de publicidade.
 */
import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

const PROMPTS = [
  'Crie uma imagem de banner para campanha de Black Friday...',
  'Gere um anúncio para Instagram sobre lançamento de produto...',
  'Crie uma imagem publicitária para promoção de verão...',
  'Gere um banner para campanha de e-commerce...',
];

// Imagens que correspondem a cada prompt (Black Friday, produto, verão, e-commerce)
const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1637748632949-c34d957b4f6a?w=400&h=220&fit=crop', // Black Friday (sinal / campanha)
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=220&fit=crop', // produto relógio
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=220&fit=crop', // praia verão
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=220&fit=crop',   // e-commerce compras
];

type Phase = 'typing' | 'processing' | 'image' | 'transition';

export default function HeroInferenceDemo() {
  const [phase, setPhase] = useState<Phase>('typing');
  const [promptIndex, setPromptIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [charIndex, setCharIndex] = useState(0);

  const currentPrompt = PROMPTS[promptIndex];
  const currentImage = PLACEHOLDER_IMAGES[promptIndex];

  // Typing effect
  useEffect(() => {
    if (phase !== 'typing') return;

    if (charIndex < currentPrompt.length) {
      const timer = setTimeout(() => {
        setDisplayedText(currentPrompt.slice(0, charIndex + 1));
        setCharIndex((c) => c + 1);
      }, 35);
      return () => clearTimeout(timer);
    }

    // Typing complete -> processing
    const timer = setTimeout(() => setPhase('processing'), 400);
    return () => clearTimeout(timer);
  }, [phase, charIndex, currentPrompt]);

  // Processing phase (2.5s)
  useEffect(() => {
    if (phase !== 'processing') return;
    const timer = setTimeout(() => setPhase('image'), 2500);
    return () => clearTimeout(timer);
  }, [phase]);

  // Image display (4s) then transition to next
  useEffect(() => {
    if (phase !== 'image') return;
    const timer = setTimeout(() => setPhase('transition'), 4000);
    return () => clearTimeout(timer);
  }, [phase]);

  // Transition: reset for next prompt
  useEffect(() => {
    if (phase !== 'transition') return;
    const timer = setTimeout(() => {
      setPromptIndex((p) => (p + 1) % PROMPTS.length);
      setDisplayedText('');
      setCharIndex(0);
      setPhase('typing');
    }, 400);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className="w-full max-w-[380px] min-w-0 bg-background rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col mx-auto">
      {/* Header */}
      <div className="bg-sidebar px-4 py-3 flex items-center gap-2 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
        </div>
        <span className="text-[11px] text-sidebar-foreground/50 mx-auto">Inferência IA ao vivo</span>
      </div>

      {/* Content: altura fixa para evitar saltos */}
      <div className="p-3 space-y-2 flex-1 flex flex-col min-h-[200px]">
        {/* Prompt input area */}
        <div className="bg-muted rounded-xl p-3 text-xs text-muted-foreground leading-relaxed min-h-[52px] shrink-0">
          <span>{displayedText}</span>
          {(phase === 'typing' || phase === 'processing') && (
            <span className="inline-block w-2 h-3.5 bg-primary ml-0.5 animate-pulse align-middle" />
          )}
        </div>

        {/* Processing state: animação de ondas */}
        {phase === 'processing' && (
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 animate-in fade-in duration-300 overflow-hidden min-h-[140px]">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-full border-2 border-primary/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-30" style={{ animationDuration: '1.5s' }} />
              </div>
              <span className="text-xs font-semibold text-primary">Gerando com IA...</span>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {Array.from({ length: 48 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-sm bg-primary/40"
                  style={{
                    animation: 'inference-pulse 1.5s ease-in-out infinite',
                    animationDelay: `${(i % 8) * 0.08 + Math.floor(i / 8) * 0.1}s`,
                  }}
                />
              ))}
            </div>
            <style>{`
              @keyframes inference-pulse {
                0%, 100% { opacity: 0.3; transform: scale(0.9); }
                50% { opacity: 1; transform: scale(1); }
              }
            `}</style>
          </div>
        )}

        {/* Generated image */}
        {phase === 'image' && (
          <div className="space-y-2 animate-in fade-in zoom-in-95 duration-500 flex-1 flex flex-col">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
              Imagem gerada
            </div>
            <div className="rounded-xl overflow-hidden border border-border bg-muted flex-1 min-h-[140px]">
              <img
                src={currentImage}
                alt="Imagem publicitária gerada"
                className="w-full h-full min-h-[140px] object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,' + encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="180" viewBox="0 0 400 180"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%238b5cf6"/><stop offset="100%" style="stop-color:%236366f1"/></linearGradient></defs><rect width="400" height="180" fill="url(%23g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="sans-serif" font-size="18" font-weight="bold">Imagem gerada</text></svg>'
                  );
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Pronto para usar em redes sociais ou anúncios.
            </p>
          </div>
        )}

        {/* Transition */}
        {phase === 'transition' && (
          <div className="flex-1 min-h-[140px] flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
