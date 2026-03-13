import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import AppTopbar from './AppTopbar';
import MobileBottomNav from './MobileBottomNav';
import { useAuthStore } from '@/store/useAuthStore';

export default function AppLayout() {
  const { isAutenticado, temPlanoAtivo, billingChecked, fetchBillingStatus, usuario, clearCache } = useAuthStore();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // ── Debug: Check auth state ──────────────────────────────────────────
    console.log('🔍 AppLayout auth state:', {
      isAutenticado,
      usuario: usuario?.email,
      billingChecked,
      temPlanoAtivo,
      ready,
    });

    // 1. Not logged in → send to login
    if (!isAutenticado) {
      console.log('❌ Não autenticado, redirecionando para /login');
      navigate('/login', { replace: true });
      return;
    }

    // 2. Already checked billing → decide now
    if (billingChecked) {
      if (!temPlanoAtivo) {
        console.log('⚠️ Sem plano ativo, redirecionando para escolher plano');
        navigate('/escolher-plano', { replace: true });
        return;
      }
      console.log('✅ Plano ativo, dashboard pronto');
      setReady(true);
      return;
    }

    // 3. First visit — fetch billing status from backend
    console.log('🔄 Buscando status de billing...');
    fetchBillingStatus()
      .then((isActive) => {
        if (!isActive) {
          console.log('⚠️ Sem plano ativo após fetch, redirecionando');
          navigate('/escolher-plano', { replace: true });
        } else {
          console.log('✅ Plano ativo confirmado');
          setReady(true);
        }
      })
      .catch((error) => {
        console.error('❌ Erro ao fetch billing:', error);
        // Retry but limit attempts
        if (retryCount < 3) {
          setRetryCount(retryCount + 1);
        } else {
          // After 3 retries, clear cache and redirect to login
          console.error('❌ Últimos retry falhou, limpando cache');
          clearCache();
          navigate('/login', { replace: true });
        }
      });
  }, [isAutenticado, temPlanoAtivo, billingChecked, fetchBillingStatus, navigate, usuario, clearCache, retryCount]);

  // Show a brief loading spinner while checking subscription
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Verificando acesso…</p>
          {retryCount > 0 && (
            <p className="text-xs text-yellow-600">Tentativa {retryCount}/3</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar — visível apenas em desktop */}
      <AppSidebar />

      {/* Conteúdo principal */}
      <div className="md:ml-[250px] transition-all duration-300">
        <AppTopbar />
        <main className="p-4 md:p-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Navegação inferior — visível apenas em mobile */}
      <MobileBottomNav />
    </div>
  );
}
