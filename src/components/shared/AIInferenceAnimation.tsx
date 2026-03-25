import { BrainCircuit } from 'lucide-react';
import { useEffect, useState } from 'react';

const steps = [
  'Analisando prompt…',
  'Processando informações…',
  'Gerando conteúdo com IA…',
  'Refinando resultado…',
];

interface Props {
  type?: 'image' | 'video' | 'text' | 'audio';
}

export default function AIInferenceAnimation({ type = 'image' }: Props) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((prev) => (prev + 1) % steps.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Pulsing rings */}
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-2 border-primary/10 animate-ping" />
        <div
          className="absolute inset-2 rounded-full border-2 border-primary/20 animate-ping"
          style={{ animationDelay: '0.3s', animationDuration: '1.5s' }}
        />
        <div
          className="absolute inset-4 rounded-full border-2 border-primary/30 animate-ping"
          style={{ animationDelay: '0.6s', animationDuration: '2s' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <BrainCircuit className="w-7 h-7 text-primary animate-pulse" />
          </div>
        </div>
      </div>

      {/* Inference dots */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary"
            style={{
              animation: 'bounce 1.4s infinite ease-in-out',
              animationDelay: `${i * 0.16}s`,
              opacity: 0.3,
            }}
          />
        ))}
      </div>

      {/* Step text */}
      <div className="text-center space-y-2">
        <p className="font-medium text-foreground transition-all duration-500">
          {steps[stepIdx]}
        </p>
        <p className="text-sm text-muted-foreground">
          {type === 'video'
            ? 'A geração de vídeo pode levar até 5 minutos.'
            : type === 'audio'
              ? 'A síntese de voz (Azure) costuma levar poucos segundos.'
              : 'A geração pode demorar alguns instantes…'}
        </p>
      </div>

      {/* Animated bar */}
      <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full"
          style={{
            animation: 'indeterminate 1.8s infinite ease-in-out',
          }}
        />
      </div>

      <style>{`
        @keyframes indeterminate {
          0%   { width: 0%; margin-left: 0; }
          50%  { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}
