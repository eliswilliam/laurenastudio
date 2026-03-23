import api from '@/lib/api';

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  link?: string | null;
  read: boolean;
  created_at: string;
}

export async function fetchNotifications(): Promise<{ items: AppNotification[]; unread_count: number }> {
  const { data } = await api.get<{ items: AppNotification[]; unread_count: number }>('/notifications/');
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all');
}

/** URL absoluta do stream SSE (EventSource não envia header Authorization). */
export function notificationsStreamUrl(token: string): string {
  const base = (api.defaults.baseURL || '/api/v1').replace(/\/$/, '');
  return `${window.location.origin}${base}/notifications/stream?token=${encodeURIComponent(token)}`;
}
