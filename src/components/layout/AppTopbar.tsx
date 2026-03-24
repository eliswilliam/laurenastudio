import { Bell, ChevronDown, Search, Moon, Sun, Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiGlobalSearch, type SearchResult } from '@/lib/billingApi';
import { useNotifications } from '@/hooks/useNotifications';

// Search type labels in PT-BR
const searchTypeLabels: Record<string, string> = {
  pages: 'Páginas',
  posts: 'Posts',
  media: 'Mídia',
  campaigns: 'Campanhas',
  social_accounts: 'Contas Sociais',
};

export default function AppTopbar() {
  const { usuario, logout } = useAuthStore();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);
  const {
    items: notificacoes,
    unreadCount: naoLidas,
    markRead,
    markAllRead,
  } = useNotifications();

  // ── Global search state ───────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Record<string, SearchResult[]>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!value.trim()) {
      setSearchResults({});
      setSearchOpen(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiGlobalSearch(value.trim());
        setSearchResults(data.results);
        setSearchOpen(true);
      } catch {
        setSearchResults({});
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleSearchSelect = (result: SearchResult) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(result.url);
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <header className="h-14 md:h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-3 md:px-6 sticky top-0 z-30">
      {/* Lado esquerdo — marca + busca */}
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        <div className="flex items-center gap-2 shrink-0 pr-1">
          <img
            src="/android-chrome-192x192.png"
            alt=""
            className="h-8 w-8 rounded-lg"
          />
          <span className="font-bagel text-sm tracking-[0.15em] text-foreground/90 hidden md:inline">
            LAURENA
          </span>
        </div>

        <div className="relative hidden md:block" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar posts, mídias, páginas..."
            className="pl-9 w-72 h-9 bg-muted/50"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => {
              if (Object.keys(searchResults).length > 0) setSearchOpen(true);
            }}
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
          {searchOpen && Object.keys(searchResults).length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-96 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
              {Object.entries(searchResults).map(([type, results]) => (
                <div key={type}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase bg-muted/30">
                    {searchTypeLabels[type] || type}
                  </div>
                  {results.map((result, idx) => (
                    <button
                      key={`${type}-${idx}`}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex flex-col"
                      onClick={() => handleSearchSelect(result)}
                    >
                      <span className="text-sm font-medium">{result.title}</span>
                      {result.description && (
                        <span className="text-xs text-muted-foreground">{result.description}</span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          {searchOpen && searchQuery && Object.keys(searchResults).length === 0 && !searching && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-popover border border-border rounded-lg shadow-lg z-50 p-4 text-center text-sm text-muted-foreground">
              Nenhum resultado para "{searchQuery}"
            </div>
          )}
        </div>
      </div>

      {/* Lado direito - Ações */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme}>
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

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
            <div className="p-4 border-b flex items-center justify-between gap-2">
              <h4 className="font-semibold text-sm">Notificações</h4>
              {naoLidas > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void markAllRead()}>
                  Marcar todas como lidas
                </Button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notificacoes.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma notificação ainda.</p>
              ) : (
                notificacoes.map((n) => {
                  const badgeVariant =
                    n.kind.includes('canceled') || n.kind.includes('failed') ? 'secondary' : n.kind.includes('plan') ? 'outline' : 'default';
                  return (
                    <button
                      type="button"
                      key={n.id}
                      className={`w-full text-left p-4 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors ${
                        !n.read ? 'bg-accent/30' : ''
                      }`}
                      onClick={() => {
                        if (n.link) {
                          window.open(n.link, '_blank', 'noopener,noreferrer');
                        }
                        if (!n.read) void markRead(n.id);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <Badge variant={badgeVariant} className="text-[10px] shrink-0 mt-0.5 max-w-[5rem] truncate">
                          {n.kind.replace(/_/g, ' ')}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{n.body}</p>
                          <p className="text-[10px] text-muted-foreground/80 mt-1">
                            {new Date(n.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>

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
