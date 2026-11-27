import axios, { type AxiosError } from 'axios';
import { formatApiError } from '@/lib/api';
import type { JobStatus } from '@/lib/criarSiteChat';

/** POST /api/publish (not under /api/v1). */
const client = axios.create({
  baseURL: '',
  /** Resposta imediata com jobId; o trabalho corre em worker ARQ. */
  timeout: 120000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(new Error(formatApiError(error)));
  }
);

export interface PublishBody {
  userId: string;
  projectId?: string | null;
  files: { path: string; content: string }[];
  /** Subdomínio (obrigatório quando o backend tem Cloudflare configurado). */
  slug?: string;
}

export interface PublishResponse {
  github: string;
  /** URL pública (subdomínio se DNS Cloudflare; senão URL Cloud Run). */
  siteUrl?: string | null;
  deployOk?: boolean;
  /** Igual a deployOk; útil para contratos que esperam success. */
  success?: boolean;
  actionsUrl?: string | null;
  /** URL direta do serviço Cloud Run (`.run.app`), útil para diagnóstico. */
  cloudRun?: string | null;
  /** True se a API criou o CNAME Cloudflare (URL canónica = subdomínio). */
  dnsApplied?: boolean;
}

/** Resposta imediata de POST /api/publish (fila ARQ). */
export interface PublishEnqueueResponse {
  jobId: string;
  projectId?: string | null;
  message: string;
}

export interface SaveTemplateBody {
  userId: string;
  projectId?: string | null;
  files: { path: string; content: string }[];
  slug?: string;
}

export interface SaveTemplateResponse {
  projectId: string;
  message: string;
}

export async function postPublish(body: PublishBody): Promise<PublishEnqueueResponse> {
  const { data } = await client.post<PublishEnqueueResponse>('/api/publish', body);
  return data;
}

export async function postSaveTemplate(body: SaveTemplateBody): Promise<SaveTemplateResponse> {
  const { data } = await client.post<SaveTemplateResponse>('/api/publish/save', body);
  return data;
}

/** GET /api/publish/jobs/{jobId} — estado do job de publicação. */
export async function getPublishJobStatus(jobId: string): Promise<JobStatus> {
  const { data } = await client.get<JobStatus>(`/api/publish/jobs/${jobId}`);
  return data;
}

/** GET /api/publish/config — requireSlug quando Cloudflare está configurado no backend. */
export async function getPublishConfig(): Promise<{ requireSlug: boolean }> {
  const { data } = await client.get<{ requireSlug: boolean }>('/api/publish/config');
  return data;
}
