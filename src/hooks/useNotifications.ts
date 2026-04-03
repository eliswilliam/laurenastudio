import { useEffect, useState, useCallback, useRef } from 'react';
import { notify } from '@/lib/notify';
import { useAuthStore } from '@/store/useAuthStore';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  notificationsStreamUrl,
  type AppNotification,
} from '@/lib/notificationsApi';

export type { AppNotification };

/** Não exibir no painel: cada login/registo gerava linhas que “enchiam” a lista. */
const EXCLUDE_FROM_INBOX_KINDS = new Set(['auth_login', 'auth_register']);

function filterInboxItems(items: AppNotification[]) {
  return items.filter((i) => !EXCLUDE_FROM_INBOX_KINDS.has(i.kind));
}

function countUnread(items: AppNotification[]) {
  return items.reduce((n, i) => n + (i.read ? 0 : 1), 0);
}

export function useNotifications() {
  const isAutenticado = useAuthStore((s) => s.isAutenticado);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const knownIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications();
      const filtered = filterInboxItems(data.items);
      setItems(filtered);
      setUnreadCount(countUnread(filtered));
      knownIds.current = new Set(filtered.map((i) => i.id));
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

    let es: EventSource | null = null;
    try {
      es = new EventSource(notificationsStreamUrl());
      es.onmessage = (ev) => {
        try {
          const n = JSON.parse(ev.data) as AppNotification;
          if (EXCLUDE_FROM_INBOX_KINDS.has(n.kind)) return;
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
            notify.success(n.title, n.body, 9000);
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
      notify.error('Não foi possível marcar como lida.', undefined, 4000);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
      setUnreadCount(0);
    } catch {
      notify.error('Não foi possível limpar as notificações.', undefined, 4000);
    }
  }, []);

  return { items, unreadCount, loading, load, markRead, markAllRead };
}
