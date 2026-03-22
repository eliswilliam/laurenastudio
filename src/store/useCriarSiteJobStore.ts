import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type Mensagem, MENSAGEM_ABERTURA_TEXTO } from '@/lib/criarSiteChat';

export interface SiteResult {
  previewUrl: string;
  downloadUrl: string;
}

const ABERTURA: Mensagem = {
  id: '0',
  papel: 'bot',
  texto: MENSAGEM_ABERTURA_TEXTO,
};

interface CriarSiteJobState {
  generateJobId: string | null;
  publishJobId: string | null;
  lista: Mensagem[];
  projectId: string | null;
  siteResult: SiteResult | null;
  githubUrl: string | null;
  publicSiteUrl: string | null;
  publishSlug: string;

  setGenerateJobId: (id: string | null) => void;
  setPublishJobId: (id: string | null) => void;
  setLista: (listaOrFn: Mensagem[] | ((prev: Mensagem[]) => Mensagem[])) => void;
  setProjectId: (id: string | null) => void;
  setSiteResult: (result: SiteResult | null) => void;
  setGithubUrl: (url: string | null) => void;
  setPublicSiteUrl: (url: string | null) => void;
  setPublishSlug: (slug: string) => void;
  
  clearGenerateJob: () => void;
  clearPublishJob: () => void;
  resetAll: () => void;
}

export const useCriarSiteJobStore = create<CriarSiteJobState>()(
  persist(
    (set) => ({
      generateJobId: null,
      publishJobId: null,
      lista: [ABERTURA],
      projectId: null,
      siteResult: null,
      githubUrl: null,
      publicSiteUrl: null,
      publishSlug: '',

      setGenerateJobId: (id) => set({ generateJobId: id }),
      setPublishJobId: (id) => set({ publishJobId: id }),
      setLista: (fn) => set((state) => ({ lista: typeof fn === 'function' ? fn(state.lista) : fn })),
      setProjectId: (id) => set({ projectId: id }),
      setSiteResult: (result) => set({ siteResult: result }),
      setGithubUrl: (url) => set({ githubUrl: url }),
      setPublicSiteUrl: (url) => set({ publicSiteUrl: url }),
      setPublishSlug: (slug) => set({ publishSlug: slug }),

      clearGenerateJob: () => set({ generateJobId: null }),
      clearPublishJob: () => set({ publishJobId: null }),
      resetAll: () => set({
        generateJobId: null,
        publishJobId: null,
        lista: [ABERTURA],
        projectId: null,
        siteResult: null,
        githubUrl: null,
        publicSiteUrl: null,
        publishSlug: ''
      })
    }),
    { name: 'laurena-criar-site-jobs' }
  )
);
