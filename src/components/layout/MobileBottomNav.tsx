import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PenSquare,
  Sparkles,
  CalendarDays,
  BarChart3,
  Megaphone,
  Image,
  CreditCard,
  Settings,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const mainItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: PenSquare,       label: 'Criar Post', href: '/criar-post' },
  { icon: Sparkles,        label: 'AI Studio',  href: '/ai-studio' },
  { icon: CalendarDays,    label: 'Agenda',     href: '/agendador' },
  { icon: BarChart3,       label: 'Analytics',  href: '/analytics' },
];

const moreItems = [
  { icon: Megaphone, label: 'Ads Analytics',      href: '/ads-analytics' },
  { icon: Image,     label: 'Biblioteca de Mídia', href: '/midia' },
  { icon: CreditCard,label: 'Pagamento',           href: '/pagamento' },
  { icon: Settings,  label: 'Configurações',       href: '/configuracoes' },
];

export default function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* Overlay para fechar o "Mais" */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* Sheet "Mais" — desliza de baixo */}
      <div
        className={cn(
          'fixed bottom-16 left-0 right-0 z-50 bg-background border-t border-border rounded-t-2xl shadow-2xl transition-transform duration-300 md:hidden',
          moreOpen ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="font-semibold text-sm">Mais opções</span>
          <button
            onClick={() => setMoreOpen(false)}
            className="p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1 p-4">
          {moreItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <Icon className="w-5 h-5" />
                <span className="text-center leading-tight">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Barra de navegação inferior */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-background border-t border-border flex items-center md:hidden">
        <div className="grid grid-cols-6 w-full h-full">
          {mainItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={cn(
                        'w-10 h-6 rounded-full flex items-center justify-center transition-colors',
                        isActive ? 'bg-primary/15' : ''
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}

          {/* Botão "Mais" */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
              moreOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div
              className={cn(
                'w-10 h-6 rounded-full flex items-center justify-center transition-colors',
                moreOpen ? 'bg-primary/15' : ''
              )}
            >
              <MoreHorizontal className="w-5 h-5" />
            </div>
            <span>Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
