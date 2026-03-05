// ==========================================
// Tipos globais da plataforma Laurena Studio
// ==========================================

// Autenticação
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  avatar?: string;
  plano: 'starter' | 'pro' | 'business';
  criadoEm: string;
}

export interface Workspace {
  id: string;
  nome: string;
  logo?: string;
  membros: number;
}

// Dashboard
export interface DashboardKPI {
  postsPublicados: number;
  taxaEngajamento: number;
  roiAnuncios: number;
  crescimentoSeguidores: number;
  postsVariacao: number;
  engajamentoVariacao: number;
  roiVariacao: number;
  seguidoresVariacao: number;
}

export interface DadosGrafico {
  nome: string;
  valor: number;
  valor2?: number;
}

// AI Studio
export type TomConteudo = 'profissional' | 'casual' | 'humoristico' | 'inspirador' | 'educativo' | 'persuasivo';
export type PlataformaSocial = 'instagram' | 'facebook' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube';
export type VozMarca = 'corporativo' | 'amigavel' | 'ousado' | 'elegante' | 'minimalista';
export type TipoConteudo = 'texto' | 'imagem' | 'video';

export interface GeracaoAIRequest {
  prompt: string;
  tipo: TipoConteudo;
  tom: TomConteudo;
  plataforma: PlataformaSocial;
  vozMarca: VozMarca;
}

export interface GeracaoAIResponse {
  id: string;
  conteudo: string;
  tipo: TipoConteudo;
  urlPreview?: string;
  criadoEm: string;
}

// Agendador
export interface PostAgendado {
  id: string;
  titulo: string;
  conteudo: string;
  plataformas: PlataformaSocial[];
  dataAgendada: string;
  horaAgendada: string;
  status: 'agendado' | 'publicado' | 'rascunho' | 'falhou';
  imagemUrl?: string;
}

// Analytics
export interface DadosAnalytics {
  impressoes: DadosGrafico[];
  engajamento: DadosGrafico[];
  cliques: DadosGrafico[];
  crescimento: DadosGrafico[];
}

// Ads Analytics
export type PlataformaAds = 'meta' | 'google' | 'tiktok';

export interface Campanha {
  id: string;
  nome: string;
  plataforma: PlataformaAds;
  status: 'ativa' | 'pausada' | 'finalizada';
  orcamento: number;
  gasto: number;
  impressoes: number;
  cliques: number;
  conversoes: number;
  cpc: number;
  cpa: number;
  roas: number;
}

export interface FiltrosAds {
  dataInicio: string;
  dataFim: string;
  plataforma?: PlataformaAds;
  campanhaId?: string;
}

// Biblioteca de mídia
export type TipoMidia = 'imagem' | 'video' | 'gerado-ia';

export interface ItemMidia {
  id: string;
  nome: string;
  tipo: TipoMidia;
  url: string;
  thumbnailUrl: string;
  tamanho: number;
  criadoEm: string;
  tags: string[];
}

// Billing
export interface Plano {
  id: string;
  nome: string;
  preco: number;
  precoAnual: number;
  recursos: string[];
  limites: {
    postsmes: number;
    geracoesIA: number;
    membros: number;
    armazenamento: string;
  };
  destaque?: boolean;
}

export interface AssinaturaAtual {
  plano: Plano;
  usoMensal: {
    posts: number;
    geracoesIA: number;
    armazenamento: number;
  };
  proximaCobranca: string;
  status: 'ativa' | 'cancelada' | 'trial';
}

// Configurações
export interface ConfiguracaoPerfil {
  nome: string;
  email: string;
  avatar?: string;
  bio?: string;
  telefone?: string;
}

export interface ConfiguracaoBranding {
  corPrimaria: string;
  logo?: string;
  fontePreferida: string;
  tomPadrao: TomConteudo;
}

export interface ContaSocial {
  id: string;
  plataforma: PlataformaSocial;
  nomeUsuario: string;
  conectada: boolean;
  avatar?: string;
}

// Notificações
export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: 'info' | 'sucesso' | 'aviso' | 'erro';
  lida: boolean;
  criadoEm: string;
}
