import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CriarSiteJobState {
  generateJobId: string | null;
  publishJobId: string | null;
  setGenerateJobId: (id: string | null) => void;
  setPublishJobId: (id: string | null) => void;
  clearGenerateJob: () => void;
  clearPublishJob: () => void;
}

export const useCriarSiteJobStore = create<CriarSiteJobState>()(
  persist(
    (set) => ({
      generateJobId: null,
      publishJobId: null,
      setGenerateJobId: (id) => set({ generateJobId: id }),
      setPublishJobId: (id) => set({ publishJobId: id }),
      clearGenerateJob: () => set({ generateJobId: null }),
      clearPublishJob: () => set({ publishJobId: null }),
    }),
    { name: 'laurena-criar-site-jobs' }
  )
);
