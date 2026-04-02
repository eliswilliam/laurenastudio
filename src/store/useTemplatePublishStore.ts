import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TemplatePublishState {
  projectId: string | null;
  publishJobId: string | null;
  publishSlug: string;
  publishState: 'idle' | 'publishing' | 'success' | 'failed';
  publishedUrl: string | null;
  publishError: string | null;
  setProjectId: (id: string | null) => void;
  setPublishJobId: (id: string | null) => void;
  setPublishSlug: (slug: string) => void;
  markPublishing: () => void;
  markPublishSuccess: (url?: string | null) => void;
  markPublishFailed: (error?: string | null) => void;
  clearPublishJob: () => void;
}

export const useTemplatePublishStore = create<TemplatePublishState>()(
  persist(
    (set) => ({
      projectId: null,
      publishJobId: null,
      publishSlug: '',
      publishState: 'idle',
      publishedUrl: null,
      publishError: null,
      setProjectId: (id) => set({ projectId: id }),
      setPublishJobId: (id) => set({ publishJobId: id }),
      setPublishSlug: (slug) => set({ publishSlug: slug }),
      markPublishing: () => set({ publishState: 'publishing', publishError: null }),
      markPublishSuccess: (url) =>
        set({ publishState: 'success', publishedUrl: url ?? null, publishError: null }),
      markPublishFailed: (error) =>
        set({ publishState: 'failed', publishError: error ?? null }),
      clearPublishJob: () => set({ publishJobId: null }),
    }),
    { name: 'laurena-template-publish' }
  )
);