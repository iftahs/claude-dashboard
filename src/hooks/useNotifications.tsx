import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type Severity = 'info' | 'warning' | 'error';

/** Optional inline action button rendered inside a toast (e.g. "Update now"). */
export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface AppNotification {
  id: string;
  severity: Severity;
  title: string;
  message?: string;
  dismissible: boolean;
  action?: NotificationAction;
  /** Fired when the user dismisses via the × (in addition to removal). Lets a
   *  caller persist a "don't show again" flag without owning the toast list. */
  onDismiss?: () => void;
}

export interface NotifyOptions {
  /** Stable id de-dupes: re-notifying the same id replaces it instead of stacking. */
  id?: string;
  severity?: Severity;
  title: string;
  message?: string;
  dismissible?: boolean;
  action?: NotificationAction;
  onDismiss?: () => void;
  /** Auto-dismiss after N ms (omit / 0 = persistent until dismissed). */
  timeoutMs?: number;
}

interface NotificationCtx {
  notifications: AppNotification[];
  notify: (opts: NotifyOptions) => string;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationCtx | null>(null);

let counter = 0;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setNotifications((list) => list.filter((n) => n.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (opts: NotifyOptions) => {
      const id = opts.id ?? `n${++counter}`;
      const next: AppNotification = {
        id,
        severity: opts.severity ?? 'info',
        title: opts.title,
        message: opts.message,
        dismissible: opts.dismissible ?? true,
        action: opts.action,
        onDismiss: opts.onDismiss,
      };
      setNotifications((list) => {
        const idx = list.findIndex((n) => n.id === id);
        if (idx === -1) return [...list, next];
        const copy = list.slice();
        copy[idx] = next;
        return copy;
      });
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      if (opts.timeoutMs && opts.timeoutMs > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), opts.timeoutMs));
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notifications, notify, dismiss }), [notifications, notify, dismiss]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationCtx {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
}
