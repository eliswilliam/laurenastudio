import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  LayoutTemplate,
  Sparkles,
  Megaphone,
  BrainCircuit,
  Globe,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebarStore } from '@/store/useSidebarStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useEffect, useMemo, useState } from 'react';
import { getPublishJobStatus } from '@/lib/publishApi';
import { useTemplatePublishStore } from '@/store/useTemplatePublishStore';

const POLL_MS = 3000;

export default function AppSidebar() {
  const { collapsed, toggle } = useSidebarStore();
  const { t } = useTranslation();
  const publishJobId = useTemplatePublishStore((s) => s.publishJobId);
  const clearPublishJob = useTemplatePublishStore((s) => s.clearPublishJob);
  const [isPublishing, setIsPublishing] = useState(Boolean(publishJobId));

  useEffect(() => {
    if (!publishJobId) {
      setIsPublishing(false);
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (intervalId !== undefined) clearInterval(intervalId);
    };

    const tick = async () => {
      if (cancelled) return;
      try {
        const job = await getPublishJobStatus(publishJobId);
        if (cancelled) return;
        if (job.status === 'success' || job.status === 'failed') {
          clearPublishJob();
          setIsPublishing(false);
          stop();
          return;
        }
        setIsPublishing(true);
      } catch {
        if (!cancelled) {
          setIsPublishing(Boolean(publishJobId));
        }
      }
    };

    setIsPublishing(true);
    void tick();
    intervalId = setInterval(() => void tick(), POLL_MS);

    return () => {
      cancelled = true;
      stop();
    };
  }, [publishJobId, clearPublishJob]);

  const menuItems = useMemo(
    () => [
      { icon: LayoutDashboard, label: t('nav.dashboard'), href: '/dashboard' },
      { icon: LayoutTemplate, label: t('nav.criarSite'), href: '/criar-site' },
      { icon: Sparkles, label: t('nav.novidade'), href: '/novidade' },
      { icon: LayoutTemplate, label: t('nav.template'), href: '/template' },
      { icon: Globe, label: t('nav.sitePublished'), href: '/sites-publicados' },
      { icon: Megaphone, label: t('nav.marketingAI'), href: '/marketing-ai' },
      { icon: BrainCircuit, label: t('nav.aiStudio'), href: '/ai-studio' },
      { icon: CreditCard, label: t('nav.pagamento'), href: '/pagamento' },
      { icon: Settings, label: t('nav.configuracoes'), href: '/configuracoes' },
    ],
    [t]
  );

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 flex-col',
        'hidden md:flex',
        collapsed ? 'w-[64px]' : 'w-[220px]'
      )}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <img src="/android-chrome-192x192.png" alt="Laurena Studio" className="w-8 h-8 rounded-lg shrink-0" />
        {!collapsed && (
          <span className="font-bagel tracking-wider text-white text-xl">
            LAURENA
          </span>
        )}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const showPublishingBadge = item.href === '/template' && isPublishing;
          const link = (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )
              }
            >
              <div className="relative shrink-0">
                <Icon className="w-5 h-5" />
                {showPublishingBadge && (
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-sidebar" />
                )}
              </div>
              {!collapsed && (
                <span className="flex items-center gap-2">
                  <span>{item.label}</span>
                  {showPublishingBadge && (
                    <span className="rounded-full border border-emerald-300/60 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100">
                      {t('pages.templateBuilder.publishing')}
                    </span>
                  )}
                </span>
              )}
            </NavLink>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={toggle}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              <span>{t('sidebar.collapse')}</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
