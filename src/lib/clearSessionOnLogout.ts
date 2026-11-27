import { useAIStudioStore } from '@/store/useAIStudioStore';
import { useCriarSiteJobStore } from '@/store/useCriarSiteJobStore';
import { useMarketingAIStore } from '@/store/useMarketingAIStore';

/**
 * Resets persisted Zustand slices tied to the signed-in user.
 * Call on logout so another account does not inherit chat/history (Criar site, AI Studio, Marketing AI).
 */
export function clearSessionOnLogout(): void {
  useCriarSiteJobStore.getState().resetAll();
  useAIStudioStore.getState().resetStudio();
  useMarketingAIStore.getState().resetForm();
}
