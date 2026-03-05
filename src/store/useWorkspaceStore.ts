import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workspace } from '@/lib/types';

interface WorkspaceState {
  workspaceAtual: Workspace | null;
  workspaces: Workspace[];
  setWorkspaceAtual: (workspace: Workspace) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  adicionarWorkspace: (workspace: Workspace) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaceAtual: null,
      workspaces: [
        {
          id: '1',
          nome: 'Meu Workspace',
          membros: 3,
        },
        {
          id: '2',
          nome: 'Agência Digital',
          membros: 8,
        },
      ],
      setWorkspaceAtual: (workspace) => set({ workspaceAtual: workspace }),
      setWorkspaces: (workspaces) => set({ workspaces }),
      adicionarWorkspace: (workspace) =>
        set((state) => ({ workspaces: [...state.workspaces, workspace] })),
    }),
    {
      name: 'laurena-workspace',
    }
  )
);
