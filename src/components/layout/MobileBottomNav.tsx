import { Link, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  LayoutTemplate,
  Megaphone,
  BrainCircuit,
  CreditCard,
  Settings,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

export default function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { t } = useTranslation();

  const mainItems = useMemo(
    () => [
      { icon: LayoutDashboard, label: t('nav.dashboard'), href: '/dashboard' },
      { icon: LayoutTemplate, label: t('nav.criarSite'), href: '/criar-site' },
      { icon: Megaphone, label: t('nav.marketingAI'), href: '/marketing-ai' },
      { icon: BrainCircuit, label: t('nav.aiStudio'), href: '/ai-studio' },
    ],
    [t]
  );

  const moreItems = useMemo(
    () => [
      { icon: LayoutTemplate, label: t('nav.template'), href: '/template' },
      { icon: CreditCard, label: t('nav.pagamento'), href: '/pagamento' },
      { icon: Settings, label: t('nav.configuracoes'), href: '/configuracoes' },
    ],
    [t]
  );

  return (
    <>
      {/* Overlay para fechar o "Mais" */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* Sheet "Mais" desliza de baixo */}
      <div
        className={cn(
          'fixed bottom-16 left-0 right-0 z-50 bg-background border-t border-border rounded-t-2xl shadow-2xl transition-transform duration-300 md:hidden',
          moreOpen ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="font-semibold text-sm">{t('sidebar.moreOptions')}</span>
          <button
            onClick={() => setMoreOpen(false)}
            className="p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-4">
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
        <div className="grid grid-cols-5 w-full h-full">
          {mainItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground visited:text-muted-foreground transition-colors hover:text-foreground"
              >
                <div className="flex h-6 w-10 items-center justify-center rounded-full">
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Botão "Mais" */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <div className="flex h-6 w-10 items-center justify-center rounded-full transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </div>
            <span>{t('sidebar.more')}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
