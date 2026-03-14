import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal as TerminalIcon, X, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import api from '@/lib/api';

interface TerminalLine {
  type: 'input' | 'stdout' | 'stderr' | 'info' | 'success';
  content: string;
}

interface TerminalPanelProps {
  project: string | null;
  externalOutput?: { stdout: string; stderr: string; label: string } | null;
}

export default function TerminalPanel({ project, externalOutput }: TerminalPanelProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'info', content: '🖥️ Terminal LAURENA CODE — Digite um comando e pressione Enter' },
  ]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [lines, scrollToBottom]);

  useEffect(() => {
    if (!externalOutput) return;
    addLine({ type: 'input', content: `▶ ${externalOutput.label}` });
    if (externalOutput.stdout) addLine({ type: 'stdout', content: externalOutput.stdout });
    if (externalOutput.stderr) addLine({ type: 'stderr', content: externalOutput.stderr });
  }, [externalOutput]);

  const addLine = useCallback((line: TerminalLine) => {
    setLines((prev) => [...prev, line]);
  }, []);

  const runCommand = async () => {
    const cmd = input.trim();
    if (!cmd || running) return;

    addLine({ type: 'input', content: `${project ? project : '~'}$ ${cmd}` });
    setHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setInput('');
    setRunning(true);

    try {
      const res = await api.post('/laurena-code/terminal', {
        command: cmd,
        cwd: project || undefined,
      }, { timeout: 70000 });

      const { stdout, stderr, exit_code } = res.data;
      if (stdout) addLine({ type: 'stdout', content: stdout });
      if (stderr) addLine({ type: 'stderr', content: stderr });
      if (exit_code === 0 && !stdout && !stderr) {
        addLine({ type: 'success', content: '✓ Comando executado com sucesso' });
      } else if (exit_code !== 0) {
        addLine({ type: 'info', content: `Processo finalizado com código ${exit_code}` });
      }
    } catch (err: any) {
      addLine({ type: 'stderr', content: `Erro: ${err.message}` });
    } finally {
      setRunning(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      runCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIdx);
        setInput(history[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIdx = historyIndex + 1;
        if (newIdx >= history.length) { setHistoryIndex(-1); setInput(''); }
        else { setHistoryIndex(newIdx); setInput(history[newIdx]); }
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([{ type: 'info', content: '🖥️ Terminal limpo' }]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] font-mono">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-[#3c3c3c] shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-[#569cd6]" />
          <span className="text-[10px] font-semibold text-[#cccccc] uppercase tracking-wider">Terminal</span>
          {project && <span className="text-[10px] text-[#888]">({project})</span>}
          {running && <Loader2 className="w-3 h-3 text-[#569cd6] animate-spin" />}
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-[#888] hover:text-white hover:bg-[#3c3c3c]" onClick={() => setLines([{ type: 'info', content: '🖥️ Terminal limpo' }])} title="Limpar (Ctrl+L)">
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <div className="p-2 text-[11px] leading-relaxed">
          {lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                'whitespace-pre-wrap break-all',
                line.type === 'input' && 'text-[#569cd6] font-bold mt-1',
                line.type === 'stdout' && 'text-[#cccccc]',
                line.type === 'stderr' && 'text-[#f48771]',
                line.type === 'info' && 'text-[#888] italic',
                line.type === 'success' && 'text-[#4ec9b0]',
              )}
            >
              {line.content}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#1a1a1a] border-t border-[#3c3c3c] shrink-0">
        <span className="text-[#569cd6] text-[11px] font-bold shrink-0">{project ? `${project}$` : '$'}</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite um comando..."
          className="flex-1 bg-transparent text-[11px] text-[#d4d4d4] placeholder:text-[#555] outline-none"
          disabled={running}
          autoFocus
        />
      </div>
    </div>
  );
}
