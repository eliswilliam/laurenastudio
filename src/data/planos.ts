/**
 * planos.ts
 * Dados padronizados dos planos de assinatura.
 * Usado em EscolherPlano, Pagamento e Index.
 */
import type { Plano } from '@/lib/types';

/** Mapeia ID do plano (API) para nome de exibição */
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
    ],
    restricoes: ['Este plano não inclui geração de vídeo'],
    limites: { postsmes: 50, geracoesIA: 150, membros: 1, armazenamento: '5GB' },
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
      'Geração de vídeo com modelo básico',
      'Financial AI: 100 requisições por mês',
      'Suporte básico',
    ],
    restricoes: [],
    limites: { postsmes: 500, geracoesIA: 400, membros: 5, armazenamento: '50GB' },
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
      'Equipas e projetos à escala ilimitada',
      'Geração de vídeo: Veo 3 (10 por mês)',
      'Financial AI: requisições ilimitadas',
      'Suporte premium',
    ],
    restricoes: [],
    limites: { postsmes: -1, geracoesIA: -1, membros: -1, armazenamento: '500GB' },
  },
];
