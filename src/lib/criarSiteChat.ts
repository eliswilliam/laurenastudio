/** Lógica reutilizável da página CriarSite (testável sem React). */

export type JobLogEntry = { ts: string; message: string };

/** Estado devolvido por GET /sites/jobs/:id e GET /api/publish/jobs/:id (polling). */
export type JobStatus = {
  jobId: string;
  jobType: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  projectId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  result: Record<string, unknown> | null;
  error: string | null;
  logs: JobLogEntry[];
};

export type Papel = 'user' | 'bot';

export interface Mensagem {
  id: string;
  papel: Papel;
  texto: string;
}

/** Mensagem de abertura (tom claro, orientado à acção). */
export const MENSAGEM_ABERTURA_TEXTO =
  'Olá! Sou a Laurena. Descreva o site (negócio, páginas, estilo). Quando estiver pronto, clique em Gerar site: a aplicação cria um site estático real (HTML com CSS integrado, responsivo), pré-visualizável aqui e descarregável em ZIP. Envie várias mensagens para afinar o briefing.';

export function respostaBot(_indiceUser: number, ultima: string): string {
  if (ultima.length < 25) {
    return 'Podemos aprofundar? Cores, tipos de letra, secções ou um site que goste como referência.';
  }
  return 'Perfeito. Já tenho uma base sólida para o brief. Quer acrescentar algo ou prefere abrir o editor agora?';
}

export function resumoUsuario(lista: Mensagem[]): string {
  return lista
    .filter((m) => m.papel === 'user')
    .map((m) => m.texto.trim())
    .filter(Boolean)
    .join('\n\n');
}
