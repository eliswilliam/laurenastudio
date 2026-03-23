import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  notificationsStreamUrl,
  type AppNotification,
} from '@/lib/notificationsApi';

export type { AppNotification };

export function useNotifications() {
  const isAutenticado = useAuthStore((s) => s.isAutenticado);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const knownIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchNotifications();
      setItems(data.items);
      setUnreadCount(data.unread_count);
      knownIds.current = new Set(data.items.map((i) => i.id));
    } catch {
      /* silencioso: rede / 401 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAutenticado) {
      setItems([]);
      setUnreadCount(0);
      knownIds.current.clear();
      return;
    }
    void load();
  }, [isAutenticado, load]);

  useEffect(() => {
    if (!isAutenticado) return;
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(notificationsStreamUrl(token));
      es.onmessage = (ev) => {
        try {
          const n = JSON.parse(ev.data) as AppNotification;
          if (knownIds.current.has(n.id)) return;
          knownIds.current.add(n.id);
          setItems((prev) => {
            if (prev.some((x) => x.id === n.id)) return prev;
            return [n, ...prev];
          });
          if (!n.read) {
            setUnreadCount((c) => c + 1);
          }
          // Evita toast duplicado com o feedback imediato da página de login/cadastro
          if (n.kind !== 'auth_login' && n.kind !== 'auth_register') {
            toast.success(n.title, {
              description: n.body,
              duration: 9000,
            });
          }
        } catch {
          /* JSON inválido */
        }
      };
      es.onerror = () => {
        es?.close();
      };
    } catch {
      /* EventSource não disponível */
    }
    return () => {
      es?.close();
    };
  }, [isAutenticado]);

  const markRead = useCallback(async (id: string) => {
    try {
      await markNotificationRead(id);
      setItems((prev) => {
        const row = prev.find((i) => i.id === id);
        if (row && !row.read) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.map((x) => (x.id === id ? { ...x, read: true } : x));
      });
    } catch {
      toast.error('Não foi possível marcar como lida.', { duration: 4000 });
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
      setUnreadCount(0);
    } catch {
      toast.error('Não foi possível limpar as notificações.', { duration: 4000 });
    }
  }, []);

  return { items, unreadCount, loading, load, markRead, markAllRead };
}
