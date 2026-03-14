import {
  Sparkles,
  Code2,
  Bug,
  TestTube2,
  Cloud,
  Brain,
  Bot,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  bgColor: string;
}

const AGENTS: Agent[] = [
  {
    id: 'planner',
    name: 'Planejador',
    description: 'Analisa a tarefa e cria um plano de execução',
    icon: Sparkles,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30',
  },
  {
    id: 'coder',
    name: 'Codificador',
    description: 'Escreve e modifica código de alta qualidade',
    icon: Code2,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30',
  },
  {
    id: 'debugger',
    name: 'Depurador',
    description: 'Analisa erros e propõe correções',
    icon: Bug,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30',
  },
  {
    id: 'tester',
    name: 'Testador',
    description: 'Gera e executa testes automatizados',
    icon: TestTube2,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10 hover:bg-green-500/20 border-green-500/30',
  },
  {
    id: 'devops',
    name: 'DevOps',
    description: 'Docker, CI/CD e deployment',
    icon: Cloud,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30',
  },
  {
    id: 'ml',
    name: 'Machine Learning',
    description: 'Modelos ML, treinamento e otimização',
    icon: Brain,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30',
  },
];

interface AgentSelectorProps {
  selectedAgents: string[];
  onToggleAgent: (agentId: string) => void;
  compact?: boolean;
}

export default function AgentSelector({
  selectedAgents,
  onToggleAgent,
  compact = false,
}: AgentSelectorProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const isSelected = selectedAgents.includes(agent.id);
          return (
            <Tooltip key={agent.id} delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onToggleAgent(agent.id)}
                  className={cn(
                    'relative w-6 h-6 rounded flex items-center justify-center transition-all border',
                    isSelected
                      ? agent.bgColor
                      : 'bg-transparent border-transparent text-[#666] hover:text-[#aaa]'
                  )}
                >
                  <Icon className={cn('w-3.5 h-3.5', isSelected ? agent.color : '')} />
                  {isSelected && (
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">
                {agent.name}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Bot className="w-3.5 h-3.5 text-[#569cd6]" />
        <span className="text-[10px] font-semibold text-[#bbbbbb] uppercase tracking-wider">
          Agentes IA
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const isSelected = selectedAgents.includes(agent.id);
          return (
            <button
              key={agent.id}
              onClick={() => onToggleAgent(agent.id)}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all border text-[11px]',
                isSelected
                  ? agent.bgColor
                  : 'bg-[#2d2d2d] border-transparent text-[#888] hover:bg-[#333] hover:text-[#ccc]'
              )}
            >
              <Icon className={cn('w-3.5 h-3.5 shrink-0', isSelected ? agent.color : '')} />
              <div className="min-w-0">
                <div className="font-medium truncate">{agent.name}</div>
              </div>
              {isSelected && (
                <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0 ml-auto" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
