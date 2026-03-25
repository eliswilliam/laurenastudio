import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearSessionOnLogout } from '@/lib/clearSessionOnLogout';
import type { Usuario } from '@/lib/types';
import { apiBillingStatus, type BillingStatusResponse } from '@/lib/billingApi';
import { isLocalDevHost, isUnreachableApiMessage } from '@/lib/api';

interface AuthState {
  usuario: Usuario | null;
  token: string | null;
  isAutenticado: boolean;
  isCarregando: boolean;
  // Subscription state
  temPlanoAtivo: boolean;
  planoNome: string | null;
  billingStatus: BillingStatusResponse | null;
  billingChecked: boolean; // true after first fetch attempt
  login: (usuario: Usuario, token: string) => void;
  logout: () => void;
  atualizarUsuario: (dados: Partial<Usuario>) => void;
  setCarregando: (carregando: boolean) => void;
  fetchBillingStatus: () => Promise<boolean>;
  setBillingStatus: (status: BillingStatusResponse) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      usuario: null,
      token: null,
      isAutenticado: false,
      isCarregando: false,
      temPlanoAtivo: false,
      planoNome: null,
      billingStatus: null,
      billingChecked: false,
      login: (usuario, token) => {
        localStorage.setItem('auth_token', token);
        set({ usuario, token, isAutenticado: true, billingChecked: false, temPlanoAtivo: false, planoNome: null, billingStatus: null });
      },
      logout: () => {
        localStorage.removeItem('auth_token');
        clearSessionOnLogout();
        set({
          usuario: null,
          token: null,
          isAutenticado: false,
          temPlanoAtivo: false,
          planoNome: null,
          billingStatus: null,
          billingChecked: false,
        });
      },
      atualizarUsuario: (dados) =>
        set((state) => ({
          usuario: state.usuario ? { ...state.usuario, ...dados } : null,
        })),
      setCarregando: (carregando) => set({ isCarregando: carregando }),
      fetchBillingStatus: async () => {
        try {
          const status = await apiBillingStatus();
          const isActive = status.is_active;
          const planName = status.subscription?.plan?.name ?? null;
          set({
            billingStatus: status,
            temPlanoAtivo: isActive,
            planoNome: planName,
            billingChecked: true,
          });
          // Also update the user's plano if active
          const usuario = get().usuario;
          if (usuario && planName) {
            set({ usuario: { ...usuario, plano: planName as Usuario['plano'] } });
          }
          return isActive;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Em localhost + dev: falha de rede (API parada / proxy) não deve apagar a assinatura
          // guardada nem forçar «escolher-plano» como se não houvesse plano.
          const grace =
            import.meta.env.DEV &&
            isLocalDevHost() &&
            isUnreachableApiMessage(msg);
          if (grace) {
            const prevAtivo = get().temPlanoAtivo;
            const prevNome = get().planoNome;
            set({
              billingChecked: true,
              temPlanoAtivo: prevAtivo,
              planoNome: prevNome,
              billingStatus: null,
            });
            console.warn(
              '[billing] API inacessível em desenvolvimento local — mantém-se o último estado de plano. ' +
                'Confirme que o backend está em http://localhost:8000 e o Vite faz proxy de /api.',
              msg
            );
            return prevAtivo;
          }
          set({ billingChecked: true, temPlanoAtivo: false, planoNome: null, billingStatus: null });
          return false;
        }
      },
      setBillingStatus: (status) => {
        const isActive = status.is_active;
        const planName = status.subscription?.plan?.name ?? null;
        set({
          billingStatus: status,
          temPlanoAtivo: isActive,
          planoNome: planName,
          billingChecked: true,
        });
      },
    }),
    {
      name: 'laurena-auth',
      partialize: (state) => ({
        usuario: state.usuario,
        token: state.token,
        isAutenticado: state.isAutenticado,
        temPlanoAtivo: state.temPlanoAtivo,
        planoNome: state.planoNome,
      }),
    }
  )
);
