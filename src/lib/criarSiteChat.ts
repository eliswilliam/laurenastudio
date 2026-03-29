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

/** Mensagem de abertura (pt-BR). */
export const MENSAGEM_ABERTURA_TEXTO =
  'Olá! Sou a Laurena. Descreva o site (negócio, páginas, estilo). Quando estiver pronto, clique em Gerar site: a aplicação cria um site estático real (HTML com CSS integrado, responsivo), que você pode visualizar aqui. Envie várias mensagens para afinar o briefing.';

export function respostaBot(_indiceUser: number, ultima: string): string {
  if (ultima.length < 25) {
    return 'Podemos aprofundar? Cores, tipografia, seções ou um site que você goste como referência.';
  }
  return 'Perfeito. Já tenho uma base sólida para o briefing. Quer acrescentar algo ou prefere seguir com a geração?';
}

export function resumoUsuario(lista: Mensagem[]): string {
  return lista
    .filter((m) => m.papel === 'user')
    .map((m) => m.texto.trim())
    .filter(Boolean)
    .join('\n\n');
}
