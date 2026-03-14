import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  Code2,
  Bug,
  TestTube2,
  Cloud,
  Brain,
  ChevronDown,
  Copy,
  Check,
  Wand2,
  FolderPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface ChatMessage {
  role: 'user' | 'assistant' | 'agent';
  content: string;
  agent?: string;
  model_used?: string;
  actions?: Array<{
    type: string;
    file?: string;
    content?: string;
    command?: string;
    description?: string;
  }>;
  timestamp?: Date;
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  available: boolean;
}

interface ChatPanelProps {
  project: string | null;
  activeFile: string | null;
  selectedCode: string | null;
  onActionExecuted?: (action: any) => void;
  onProjectCreated?: (project: string) => void;
}

const AGENT_ICONS: Record<string, any> = {
  planner: Sparkles,
  coder: Code2,
  debugger: Bug,
  tester: TestTube2,
  devops: Cloud,
  ml: Brain,
};

const AGENT_COLORS: Record<string, string> = {
  planner: 'text-purple-400',
  coder: 'text-blue-400',
  debugger: 'text-red-400',
  tester: 'text-green-400',
  devops: 'text-orange-400',
  ml: 'text-cyan-400',
};

const AGENT_LABELS: Record<string, string> = {
  planner: 'Planejador',
  coder: 'Codificador',
  debugger: 'Depurador',
  tester: 'Testador',
  devops: 'DevOps',
  ml: 'Machine Learning',
};

const QUICK_COMMANDS = [
  { cmd: '/fix', label: 'Corrigir bug', icon: Bug },
  { cmd: '/explain', label: 'Explicar código', icon: Sparkles },
  { cmd: '/refactor', label: 'Refatorar', icon: Wand2 },
  { cmd: '/test', label: 'Gerar testes', icon: TestTube2 },
  { cmd: '/create', label: 'Criar projeto', icon: FolderPlus },
];

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-2 rounded-md overflow-hidden border border-[#3c3c3c]">
      <div className="flex items-center justify-between px-3 py-1 bg-[#2d2d2d] text-[10px] text-[#888]">
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[#888] hover:text-white"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
      <pre className="p-3 bg-[#1e1e1e] text-[12px] overflow-x-auto">
        <code className="text-[#d4d4d4]">{code}</code>
      </pre>
    </div>
  );
}

function parseMessage(content: string) {
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', content: match[2], language: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text' as const, content }];
}

export default function ChatPanel({
  project,
  activeFile,
  selectedCode,
  onActionExecuted,
  onProjectCreated,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        '👋 Olá! Sou o assistente IA do **LAURENA CODE**.\n\n' +
        'Posso ajudar você a:\n' +
        '- 🚀 Criar projetos completos a partir de descrições\n' +
        '- 💻 Escrever e editar código\n' +
        '- 🐛 Encontrar e corrigir bugs\n' +
        '- 🧪 Gerar testes automatizados\n' +
        '- 🚢 Configurar deploy e CI/CD\n\n' +
        'Use os comandos rápidos ou descreva o que precisa!',
      agent: 'coder',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.get('/laurena-code/models').then((res) => setModels(res.data)).catch(() => {
      setModels([
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', description: 'Modelo rápido do Google', available: true },
      ]);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const isCreateProject = msg.toLowerCase().startsWith('/create') || msg.toLowerCase().startsWith('crie um projeto') || msg.toLowerCase().startsWith('criar um projeto');

      if (isCreateProject) {
        const desc = msg.replace(/^\/create\s*/i, '');
        const res = await api.post('/laurena-code/projects', {
          description: desc,
          model_id: selectedModel,
        }, { timeout: 120000 });

        const data = res.data;
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content:
            `✅ Projeto **${data.project_name}** criado com sucesso!\n\n` +
            `📁 Arquivos criados: ${data.files_created.length}\n` +
            data.files_created.map((f: string) => `  - \`${f}\``).join('\n') +
            `\n\n${data.summary}`,
          agent: 'coder',
          model_used: selectedModel,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        onProjectCreated?.(data.project_name);
      } else {
        const history = messages.slice(-10).map((m) => ({
          role: m.role === 'assistant' || m.role === 'agent' ? 'assistant' : 'user',
          content: m.content,
        }));

        const res = await api.post('/laurena-code/chat', {
          message: msg,
          model_id: selectedModel,
          project_path: project,
          active_file: activeFile,
          selected_code: selectedCode,
          conversation_history: history,
        }, { timeout: 120000 });

        const data = res.data;
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: data.message,
          agent: data.agent,
          model_used: data.model_used,
          actions: data.actions,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        if (data.actions?.length > 0) {
          for (const action of data.actions) {
            onActionExecuted?.(action);
          }
        }
      }
    } catch (err: any) {
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: `❌ Erro: ${err.message || 'Falha ao processar a solicitação.'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleQuickCommand = (cmd: string) => {
    setInput(cmd + ' ');
    textareaRef.current?.focus();
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3c3c3c] bg-[#252526]">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#569cd6]" />
          <span className="text-xs font-semibold text-[#cccccc]">Chat IA</span>
        </div>
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="h-6 w-[160px] text-[10px] bg-[#3c3c3c] border-[#555] text-[#ccc]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#252526] border-[#3c3c3c]">
            {models.map((m) => (
              <SelectItem
                key={m.id}
                value={m.id}
                disabled={!m.available}
                className="text-[11px] text-[#ccc]"
              >
                <span className="flex items-center gap-1.5">
                  {m.name}
                  {!m.available && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-[#555] text-[#888]">
                      Em breve
                    </Badge>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-3 space-y-4">
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const AgentIcon = msg.agent ? AGENT_ICONS[msg.agent] || Bot : Bot;

            return (
              <div key={i} className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    isUser ? 'bg-[#569cd6]' : 'bg-[#333]'
                  )}
                >
                  {isUser ? (
                    <User className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <AgentIcon
                      className={cn(
                        'w-3.5 h-3.5',
                        msg.agent ? AGENT_COLORS[msg.agent] : 'text-[#569cd6]'
                      )}
                    />
                  )}
                </div>
                <div
                  className={cn(
                    'flex-1 min-w-0',
                    isUser && 'text-right'
                  )}
                >
                  {!isUser && msg.agent && (
                    <span className={cn('text-[10px] font-medium', AGENT_COLORS[msg.agent] || 'text-[#569cd6]')}>
                      {AGENT_LABELS[msg.agent] || msg.agent}
                    </span>
                  )}
                  <div
                    className={cn(
                      'rounded-lg px-3 py-2 text-[12px] leading-relaxed inline-block max-w-full text-left',
                      isUser
                        ? 'bg-[#264f78] text-white'
                        : 'bg-[#2d2d2d] text-[#d4d4d4]'
                    )}
                  >
                    {parseMessage(msg.content).map((part, j) =>
                      part.type === 'code' ? (
                        <CodeBlock key={j} code={part.content} language={part.language} />
                      ) : (
                        <span key={j} className="whitespace-pre-wrap">
                          {part.content}
                        </span>
                      )
                    )}
                  </div>
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {msg.actions.map((action, j) => (
                        <div
                          key={j}
                          className="flex items-center gap-1.5 text-[10px] text-[#888] bg-[#1a1a2e] px-2 py-1 rounded"
                        >
                          <Code2 className="w-3 h-3" />
                          <span className="font-mono">
                            {action.type}: {action.file || action.command || ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-[#333] flex items-center justify-center">
                <Loader2 className="w-3.5 h-3.5 text-[#569cd6] animate-spin" />
              </div>
              <div className="bg-[#2d2d2d] rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-[12px] text-[#888]">
                  <span className="animate-pulse">Pensando</span>
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-[#569cd6] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 rounded-full bg-[#569cd6] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 rounded-full bg-[#569cd6] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick commands */}
      <div className="px-3 py-1.5 border-t border-[#3c3c3c] flex gap-1 flex-wrap">
        {QUICK_COMMANDS.map((qc) => {
          const Icon = qc.icon;
          return (
            <button
              key={qc.cmd}
              onClick={() => handleQuickCommand(qc.cmd)}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#2d2d2d] text-[#aaa] hover:text-white hover:bg-[#3c3c3c] transition-colors"
            >
              <Icon className="w-2.5 h-2.5" />
              {qc.label}
            </button>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-[#3c3c3c] bg-[#252526]">
        {selectedCode && (
          <div className="mb-1.5 px-2 py-1 bg-[#1a1a2e] rounded text-[10px] text-[#888] flex items-center gap-1">
            <Code2 className="w-3 h-3" />
            <span className="truncate">Código selecionado ({selectedCode.split('\n').length} linhas)</span>
          </div>
        )}
        <div className="flex gap-1.5">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Descreva o que deseja criar ou pergunte algo..."
            className="min-h-[36px] max-h-[120px] resize-none text-[12px] bg-[#3c3c3c] border-[#555] text-[#d4d4d4] placeholder:text-[#666]"
            rows={1}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 bg-[#569cd6] hover:bg-[#4e8dc5]"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
