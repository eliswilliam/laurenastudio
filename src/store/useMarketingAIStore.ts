import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MarketingImageResult {
  image_url: string | null;
  ai_text: string | null;
  usage_after: number;
  limit: number;
  message: string;
}

export interface MarketingVideoResult {
  video_url: string;
  usage_after: number;
  limit: number;
  message: string;
}

type GenerationType = 'image' | 'video' | null;
type VideoMode = 'text_to_video' | 'image_to_video';

interface MarketingAIState {
  selectedType: GenerationType;
  videoMode: VideoMode;
  brandName: string;
  adText: string;
  prompt: string;
  referenceMime: string;
  imageResult: MarketingImageResult | null;
  videoResult: MarketingVideoResult | null;

  setSelectedType: (t: GenerationType) => void;
  setVideoMode: (m: VideoMode) => void;
  setBrandName: (s: string) => void;
  setAdText: (s: string) => void;
  setPrompt: (s: string) => void;
  setReferenceMime: (s: string) => void;
  setImageResult: (r: MarketingImageResult | null) => void;
  setVideoResult: (r: MarketingVideoResult | null) => void;
  resetForm: () => void;
}

const initial = {
  selectedType: null as GenerationType,
  videoMode: 'text_to_video' as VideoMode,
  brandName: '',
  adText: '',
  prompt: '',
  referenceMime: 'image/png',
  imageResult: null as MarketingImageResult | null,
  videoResult: null as MarketingVideoResult | null,
};

export const useMarketingAIStore = create<MarketingAIState>()(
  persist(
    (set) => ({
      ...initial,

      setSelectedType: (selectedType) => set({ selectedType }),
      setVideoMode: (videoMode) => set({ videoMode }),
      setBrandName: (brandName) => set({ brandName }),
      setAdText: (adText) => set({ adText }),
      setPrompt: (prompt) => set({ prompt }),
      setReferenceMime: (referenceMime) => set({ referenceMime }),
      setImageResult: (imageResult) => set({ imageResult }),
      setVideoResult: (videoResult) => set({ videoResult }),
      resetForm: () => set({ ...initial }),
    }),
    { name: 'laurena-marketing-ai' }
  )
);
