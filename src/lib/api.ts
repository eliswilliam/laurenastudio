import axios, { type AxiosError } from 'axios';

import type { JobStatus } from '@/lib/criarSiteChat';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Extrai mensagem legível da resposta FastAPI ou erro de rede (para o utilizador). */
export function formatApiError(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : 'Ocorreu um erro inesperado';
  }
  const ax = error as AxiosError<{ detail?: unknown; message?: string }>;
  if (!ax.response) {
    if (ax.code === 'ECONNABORTED')
      return 'O pedido expirou (timeout). Se estiver a gerar um site, tente de novo.';
    if (ax.message === 'Network Error')
      return 'Sem ligação ao servidor. Confirme que a API está a correr (ex.: http://localhost:8000) e que o proxy /api funciona.';
    return ax.message || 'Ocorreu um erro inesperado';
  }
  const data = ax.response.data;
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((item: { msg?: string; type?: string }) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'msg' in item && typeof item.msg === 'string')
        return item.msg;
      return JSON.stringify(item);
    });
    return parts.join(' · ') || `Erro HTTP ${ax.response.status}`;
  }
  if (detail && typeof detail === 'object') {
    const d = detail as Record<string, unknown>;
    if (typeof d.message === 'string') return d.message;
  }
  if (typeof data?.message === 'string') return data.message;
  return `Erro HTTP ${ax.response.status} (${ax.response.statusText || 'sem detalhe'})`;
}

/** True when the browser could not reach the API (backend down, proxy, DNS, timeout). */
export function isUnreachableApiMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('sem ligação ao servidor') ||
    m.includes('network error') ||
    m.includes('timeout') ||
    m.includes('expirou') ||
    m.includes('econnaborted') ||
    m.includes('err_network') ||
    m.includes('failed to fetch') ||
    // Proxy Vite quando o backend em :8000 não está a correr
    /erro http 502|erro http 503|erro http 504|bad gateway|service unavailable|gateway timeout/i.test(
      message
    )
  );
}

export function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

// Interceptor de token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de resposta: detalhe FastAPI + 401 → login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(new Error(formatApiError(error)));
  }
);

/** GET /api/v1/sites/jobs/{jobId} — poll site generation job (ARQ). */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const { data } = await api.get<JobStatus>(`/sites/jobs/${jobId}`);
  return data;
}

/** GET /api/v1/ai/jobs/{jobId} — poll Veo video job (AI Studio / Marketing). */
export async function getAiVideoJobStatus(jobId: string): Promise<JobStatus> {
  const { data } = await api.get<JobStatus>(`/ai/jobs/${jobId}`);
  return data;
}

/**
 * POST /api/v1/ai/speech/synthesize — Azure TTS; returns WAV blob.
 * Uses validateStatus so JSON error bodies on 4xx/5xx can be read from the blob.
 */
export async function synthesizeSpeechWav(
  text: string,
  voiceName?: string | null
): Promise<Blob> {
  const res = await api.post<Blob>(
    '/ai/speech/synthesize',
    { text, voice_name: voiceName ?? undefined },
    {
      responseType: 'blob',
      validateStatus: () => true,
    }
  );

  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }

  if (res.status !== 200) {
    let msg = `Erro HTTP ${res.status}`;
    try {
      const t = await res.data.text();
      const j = JSON.parse(t) as { detail?: unknown };
      if (typeof j.detail === 'string') msg = j.detail;
      else if (Array.isArray(j.detail) && j.detail[0] && typeof j.detail[0] === 'object')
        msg = String((j.detail[0] as { msg?: string }).msg ?? msg);
    } catch {
      /* keep msg */
    }
    throw new Error(msg);
  }

  return res.data;
}

export default api;
