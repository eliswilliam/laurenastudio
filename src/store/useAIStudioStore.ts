import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StudioMode = null | 'gemini' | 'video' | 'audio';

export interface StudioChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'text' | 'audio';
  /** ISO string — persist-friendly */
  timestamp: string;
}

interface AIStudioState {
  mode: StudioMode;
  messages: StudioChatMessage[];
  input: string;

  setMode: (m: StudioMode) => void;
  setMessages: (fn: StudioChatMessage[] | ((prev: StudioChatMessage[]) => StudioChatMessage[])) => void;
  setInput: (s: string) => void;
  resetStudio: () => void;
}

const initial = {
  mode: null as StudioMode,
  messages: [] as StudioChatMessage[],
  input: '',
};

export const useAIStudioStore = create<AIStudioState>()(
  persist(
    (set) => ({
      ...initial,

      setMode: (mode) => set({ mode }),
      setMessages: (fn) =>
        set((state) => ({
          messages: typeof fn === 'function' ? fn(state.messages) : fn,
        })),
      setInput: (input) => set({ input }),
      resetStudio: () => set({ ...initial }),
    }),
    { name: 'laurena-ai-studio' }
  )
);
