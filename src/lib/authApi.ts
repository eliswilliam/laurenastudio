/**
 * authApi.ts: typed wrappers for the FastAPI /auth endpoints
 */
import api from './api';

// ── Response types (match backend schemas) ─────────────────────────────────

export interface UserRead {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
  full_name?: string | null;
  avatar_url?: string | null;
  google_id?: string | null;
  facebook_id?: string | null;
  phone?: string | null;
  bio?: string | null;
  /** Indica se o utilizador já tem senha local (login por e-mail). */
  password_set?: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

export interface AuthResponse {
  user: UserRead;
  tokens: TokenResponse;
  tenant_id: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface VerifyResetCodeResponse {
  valid: boolean;
  message: string;
}

export interface MessageResponse {
  message: string;
}

export interface UserUpdateRequest {
  full_name?: string | null;
  phone?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  new_password?: string | null;
  current_password?: string | null;
}

// ── API calls ──────────────────────────────────────────────────────────────

export async function apiRegister(
  email: string,
  password: string,
  account_name = 'Minha conta',
  full_name?: string | null
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/register', {
    email,
    password,
    account_name,
    ...(full_name != null && String(full_name).trim() !== ''
      ? { full_name: String(full_name).trim() }
      : {}),
  });
  return res.data;
}

export async function apiLogin(
  email: string,
  password: string,
  recaptchaToken: string
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/login', {
    email,
    password,
    recaptcha_token: recaptchaToken,
  });
  return res.data;
}

export async function apiForgotPassword(
  email: string
): Promise<ForgotPasswordResponse> {
  const res = await api.post<ForgotPasswordResponse>('/auth/forgot-password', { email });
  return res.data;
}

export async function apiVerifyResetCode(
  email: string,
  code: string
): Promise<VerifyResetCodeResponse> {
  const res = await api.post<VerifyResetCodeResponse>('/auth/verify-reset-code', {
    email,
    code,
  });
  return res.data;
}

export async function apiResetPassword(
  email: string,
  code: string,
  new_password: string
): Promise<MessageResponse> {
  const res = await api.post<MessageResponse>('/auth/reset-password', {
    email,
    code,
    new_password,
  });
  return res.data;
}

export async function apiMe(): Promise<UserRead> {
  const res = await api.get<UserRead>('/auth/me');
  return res.data;
}

export async function apiUpdateProfile(data: UserUpdateRequest): Promise<UserRead> {
  const res = await api.put<UserRead>('/auth/me', data);
  return res.data;
}

export async function apiUploadAvatar(file: File): Promise<UserRead> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<UserRead>('/auth/me/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

/** URL absoluta para `<img src>` ou avatar na topbar (paths relativos passam pelo mesmo host que o SPA). */
export function resolveAvatarDisplayUrl(avatar_url: string | null | undefined): string | undefined {
  if (!avatar_url?.trim()) return undefined;
  const u = avatar_url.trim();
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${u.startsWith('/') ? u : `/${u}`}`;
  }
  return u;
}

/**
 * Redirect the browser to the Google OAuth consent screen.
 */
export function redirectToGoogleLogin(): void {
  window.location.href = '/api/v1/auth/google';
}

/**
 * Redirect the browser to the Facebook OAuth consent screen.
 */
export function redirectToFacebookLogin(): void {
  window.location.href = '/api/v1/auth/facebook';
}
