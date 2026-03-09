import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workspace } from '@/lib/types';
import { apiListWorkspaces, apiCreateWorkspace } from '@/lib/billingApi';

interface WorkspaceState {
  workspaceAtual: Workspace | null;
  workspaces: Workspace[];
  workspaceLimit: number;
  setWorkspaceAtual: (workspace: Workspace) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  adicionarWorkspace: (workspace: Workspace) => void;
  fetchWorkspaces: () => Promise<void>;
  criarWorkspace: (name: string) => Promise<Workspace>;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaceAtual: null,
      workspaces: [],
      workspaceLimit: 1,
      setWorkspaceAtual: (workspace) => set({ workspaceAtual: workspace }),
      setWorkspaces: (workspaces) => set({ workspaces }),
      adicionarWorkspace: (workspace) =>
        set((state) => ({ workspaces: [...state.workspaces, workspace] })),
      fetchWorkspaces: async () => {
        try {
          const data = await apiListWorkspaces();
          const workspaces: Workspace[] = data.workspaces.map((ws) => ({
            id: ws.id,
            nome: ws.name,
            membros: 1,
            owner_id: ws.owner_id,
            created_at: ws.created_at,
          }));
          set({
            workspaces,
            workspaceLimit: data.workspace_limit,
          });
          // Set first workspace as current if none selected
          if (!get().workspaceAtual && workspaces.length > 0) {
            set({ workspaceAtual: workspaces[0] });
          }
        } catch {
          // Keep existing data on error
        }
      },
      criarWorkspace: async (name: string) => {
        const data = await apiCreateWorkspace(name);
        const ws: Workspace = {
          id: data.id,
          nome: data.name,
          membros: 1,
          owner_id: data.owner_id,
          created_at: data.created_at,
        };
        set((state) => ({ workspaces: [...state.workspaces, ws] }));
        return ws;
      },
    }),
    {
      name: 'laurena-workspace',
    }
  )
);
