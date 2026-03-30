/**
 * planos.ts
 * Dados padronizados dos planos de assinatura.
 * Usado em EscolherPlano, Pagamento e Index.
 */
import type { Plano } from '@/lib/types';

/**
 * Quotas no backend (tabela `plans` + check_and_increment_usage):
 * text_limit, image_limit, video_limit, audio_limit, site_publish_limit.
 * 0 = ilimitado (exceto onde o produto define número explícito na UI).
 *
 * « Financial AI » é apenas marketing; não há contador dedicado na API.
 */
export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  starter: 'Starter',
  pro: 'Professional',
  business: 'Business',
};

export const PLANOS: Plano[] = [
  {
    id: 'starter',
    nome: 'Starter',
    preco: 49,
    precoAnual: 37,
    recursos: [
      '100 gerações de texto com IA',
      '50 gerações de imagem',
      'Todos os seus projetos num só lugar',
      '5 gerações de vídeo por mês',
      '3 publicações de site por mês',
      '10 gerações de áudio por mês',
    ],
    restricoes: [],
    limites: { geracoesIA: 150, membros: 1, armazenamento: '5GB' },
  },
  {
    id: 'pro',
    nome: 'Professional',
    preco: 129,
    precoAnual: 99,
    recursos: [
      '300 gerações de texto com IA',
      '100 gerações de imagem',
      'Colaboração para equipas em crescimento',
      '20 gerações de vídeo por mês',
      '6 publicações de site por mês',
      '20 gerações de áudio por mês',
      'Suporte básico',
    ],
    restricoes: [],
    limites: { geracoesIA: 400, membros: 5, armazenamento: '50GB' },
    destaque: true,
  },
  {
    id: 'business',
    nome: 'Business',
    preco: 349,
    precoAnual: 279,
    recursos: [
      'Geração de texto ilimitada',
      'Geração de imagem ilimitada',
      'Gerações de áudio ilimitadas',
      'Equipas e projetos à escala ilimitada',
      '100 gerações de vídeo por mês',
      '30 publicações de site por mês',
      'Financial AI: requisições ilimitadas',
      'Suporte premium',
    ],
    restricoes: [],
    limites: { geracoesIA: -1, membros: -1, armazenamento: '500GB' },
  },
];
