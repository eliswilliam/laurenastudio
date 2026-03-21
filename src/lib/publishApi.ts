import axios, { type AxiosError } from 'axios';
import { formatApiError } from '@/lib/api';

/** POST /api/publish (not under /api/v1). */
const client = axios.create({
  baseURL: '',
  /** Inclui espera pelo deploy no Cloud Run (polling na API). */
  timeout: 720000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
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

export async function postPublish(body: PublishBody): Promise<PublishResponse> {
  const { data } = await client.post<PublishResponse>('/api/publish', body);
  return data;
}

/** GET /api/publish/config — requireSlug quando Cloudflare está configurado no backend. */
export async function getPublishConfig(): Promise<{ requireSlug: boolean }> {
  const { data } = await client.get<{ requireSlug: boolean }>('/api/publish/config');
  return data;
}
