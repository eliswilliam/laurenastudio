import { create } from 'zustand';
import type { TipoConteudo, TomConteudo, PlataformaSocial, VozMarca, GeracaoAIResponse } from '@/lib/types';

interface AIState {
  prompt: string;
  tipo: TipoConteudo;
  tom: TomConteudo;
  plataforma: PlataformaSocial;
  vozMarca: VozMarca;
  isGerando: boolean;
  resultado: GeracaoAIResponse | null;
  historico: GeracaoAIResponse[];
  setPrompt: (prompt: string) => void;
  setTipo: (tipo: TipoConteudo) => void;
  setTom: (tom: TomConteudo) => void;
  setPlataforma: (plataforma: PlataformaSocial) => void;
  setVozMarca: (voz: VozMarca) => void;
  setGerando: (gerando: boolean) => void;
  setResultado: (resultado: GeracaoAIResponse | null) => void;
  adicionarHistorico: (item: GeracaoAIResponse) => void;
  limpar: () => void;
}

export const useAIStore = create<AIState>()((set) => ({
  prompt: '',
  tipo: 'texto',
  tom: 'profissional',
  plataforma: 'instagram',
  vozMarca: 'amigavel',
  isGerando: false,
  resultado: null,
  historico: [],
  setPrompt: (prompt) => set({ prompt }),
  setTipo: (tipo) => set({ tipo }),
  setTom: (tom) => set({ tom }),
  setPlataforma: (plataforma) => set({ plataforma }),
  setVozMarca: (voz) => set({ vozMarca: voz }),
  setGerando: (gerando) => set({ isGerando: gerando }),
  setResultado: (resultado) => set({ resultado }),
  adicionarHistorico: (item) =>
    set((state) => ({ historico: [item, ...state.historico] })),
  limpar: () => set({ prompt: '', resultado: null }),
}));
