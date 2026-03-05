import { Bell, ChevronDown, Search, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/useAuthStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

const notificacoesMock = [
  {
    id: '1',
    titulo: 'Post publicado com sucesso',
    mensagem: 'Seu post no Instagram foi publicado.',
    tipo: 'sucesso' as const,
    lida: false,
    criadoEm: '2026-03-02T10:00:00',
  },
  {
    id: '2',
    titulo: 'Campanha finalizada',
    mensagem: 'A campanha "Black Friday" foi encerrada.',
    tipo: 'info' as const,
    lida: false,
    criadoEm: '2026-03-01T15:30:00',
  },
  {
    id: '3',
    titulo: 'Limite de geração IA',
    mensagem: 'Você usou 80% do seu limite mensal.',
    tipo: 'aviso' as const,
    lida: true,
    criadoEm: '2026-02-28T09:00:00',
  },
];

export default function AppTopbar() {
  const { usuario, logout } = useAuthStore();
  const { workspaceAtual, workspaces, setWorkspaceAtual } = useWorkspaceStore();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const naoLidas = notificacoesMock.filter((n) => !n.lida).length;

  return (
    <header className="h-14 md:h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-3 md:px-6 sticky top-0 z-30">
      {/* Lado esquerdo - Workspace + Busca */}
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        {/* Seletor de Workspace */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="gap-2 font-medium h-9 px-2 md:px-3"
            >
              <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {(workspaceAtual?.nome || workspaces[0]?.nome || 'W')[0]}
              </div>
              <span className="hidden sm:inline max-w-[150px] truncate">
                {workspaceAtual?.nome || workspaces[0]?.nome || 'Workspace'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => setWorkspaceAtual(ws)}
                className="gap-2"
              >
                <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {ws.nome[0]}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{ws.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {ws.membros} membros
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Barra de busca */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="pl-9 w-64 h-9 bg-muted/50"
          />
        </div>
      </div>

      {/* Lado direito - Ações */}
      <div className="flex items-center gap-2">
        {/* Tema */}
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme}>
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* Notificações */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="w-4 h-4" />
              {naoLidas > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                  {naoLidas}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="p-4 border-b">
              <h4 className="font-semibold text-sm">Notificações</h4>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notificacoesMock.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors ${
                    !n.lida ? 'bg-accent/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Badge
                      variant={
                        n.tipo === 'sucesso'
                          ? 'default'
                          : n.tipo === 'aviso'
                          ? 'secondary'
                          : 'outline'
                      }
                      className="text-[10px] shrink-0 mt-0.5"
                    >
                      {n.tipo}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{n.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {n.mensagem}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Menu do usuário */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 h-9 pl-2 pr-3">
              <Avatar className="w-7 h-7">
                <AvatarImage src={usuario?.avatar} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {usuario?.nome?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate">
                {usuario?.nome || 'Usuário'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{usuario?.nome || 'Usuário'}</p>
                <p className="text-xs text-muted-foreground font-normal">
                  {usuario?.email || 'usuario@email.com'}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/pagamento')}>
              Plano & Pagamento
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="text-destructive"
            >
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
