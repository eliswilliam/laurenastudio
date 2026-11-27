import { toast as pushToast, dismissToast } from '@/hooks/use-toast';

export const DEFAULT_NOTIFY_DURATION = 4000;

export type NotifyType = 'success' | 'error' | 'warning' | 'info';

export interface NotifyShowOptions {
  type?: NotifyType;
  title: string;
  message?: string;
  duration?: number;
  closable?: boolean;
}

function mapTypeToVariant(type: NotifyType): 'default' | 'success' | 'destructive' | 'warning' | 'info' {
  switch (type) {
    case 'success':
      return 'success';
    case 'error':
      return 'destructive';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'default';
  }
}

function resolveDuration(duration: number | undefined): number | undefined {
  if (duration === undefined) return DEFAULT_NOTIFY_DURATION;
  if (duration === 0) return Number.MAX_SAFE_INTEGER;
  return duration;
}

/**
 * API globale façon « window.notify » — feedback UX cohérent (Laurena).
 * Utiliser depuis n’importe quel module sans hook React.
 */
export const notify = {
  show(options: NotifyShowOptions) {
    const { type = 'info', title, message, duration, closable = true } = options;
    const variant = mapTypeToVariant(type);
    pushToast({
      title,
      description: message,
      variant,
      duration: resolveDuration(duration),
      closable,
    });
  },

  success(title: string, message?: string, duration: number = DEFAULT_NOTIFY_DURATION) {
    notify.show({ type: 'success', title, message, duration });
  },

  error(title: string, message?: string, duration: number = DEFAULT_NOTIFY_DURATION) {
    notify.show({ type: 'error', title, message, duration });
  },

  warning(title: string, message?: string, duration: number = DEFAULT_NOTIFY_DURATION) {
    notify.show({ type: 'warning', title, message, duration });
  },

  info(title: string, message?: string, duration: number = DEFAULT_NOTIFY_DURATION) {
    notify.show({ type: 'info', title, message, duration });
  },

  clearAll() {
    dismissToast();
  },
} as const;

export type NotifyApi = typeof notify;

declare global {
  interface Window {
    notify?: NotifyApi;
  }
}

export function attachNotifyToWindow() {
  window.notify = notify;
}
