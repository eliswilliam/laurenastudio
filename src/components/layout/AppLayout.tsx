import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import AppTopbar from './AppTopbar';
import MobileBottomNav from './MobileBottomNav';
import { useAuthStore } from '@/store/useAuthStore';

export default function AppLayout() {
  const { isAutenticado, temPlanoAtivo, billingChecked, fetchBillingStatus } = useAuthStore();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 1. Not logged in → send to login
    if (!isAutenticado) {
      navigate('/login', { replace: true });
      return;
    }

    // 2. Already checked billing → decide now
    if (billingChecked) {
      if (!temPlanoAtivo) {
        navigate('/escolher-plano', { replace: true });
        return;
      }
      setReady(true);
      return;
    }

    // 3. First visit — fetch billing status from backend
    fetchBillingStatus().then((isActive) => {
      if (!isActive) {
        navigate('/escolher-plano', { replace: true });
      } else {
        setReady(true);
      }
    });
  }, [isAutenticado, temPlanoAtivo, billingChecked, fetchBillingStatus, navigate]);

  // Show a brief loading spinner while checking subscription
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Verificando assinatura…</p>
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
