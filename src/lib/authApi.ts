/**
 * authApi.ts — typed wrappers for the FastAPI /auth endpoints
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
}

export interface WorkspaceRead {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

export interface AuthResponse {
  user: UserRead;
  workspace: WorkspaceRead;
  tokens: TokenResponse;
}

export interface ForgotPasswordResponse {
  message: string;
  reset_token?: string; // returned for testing
}

export interface MessageResponse {
  message: string;
}

// ── API calls ──────────────────────────────────────────────────────────────

export async function apiRegister(
  email: string,
  password: string,
  workspace_name = 'My Workspace'
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/register', {
    email,
    password,
    workspace_name,
  });
  return res.data;
}

export async function apiLogin(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/login', { email, password });
  return res.data;
}

export async function apiForgotPassword(
  email: string
): Promise<ForgotPasswordResponse> {
  const res = await api.post<ForgotPasswordResponse>('/auth/forgot-password', {
    email,
  });
  return res.data;
}

export async function apiResetPassword(
  token: string,
  new_password: string
): Promise<MessageResponse> {
  const res = await api.post<MessageResponse>('/auth/reset-password', {
    token,
    new_password,
  });
  return res.data;
}

export async function apiMe(): Promise<UserRead> {
  const res = await api.get<UserRead>('/auth/me');
  return res.data;
}

/**
 * Redirect the browser to the Google OAuth consent screen.
 * The backend will handle the callback and redirect back to /auth/callback.
 */
export function redirectToGoogleLogin(): void {
  window.location.href = '/api/v1/auth/google';
}
