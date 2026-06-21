import type { Severity } from '@/hooks/useNotifications';
import type { ToastProps } from './types';

const STYLES: Record<Severity, { accent: string; icon: string; iconColor: string }> = {
  info: { accent: 'border-l-blue-400', icon: 'ⓘ', iconColor: 'text-blue-400' },
  warning: { accent: 'border-l-amber-400', icon: '⚠', iconColor: 'text-amber-400' },
  error: { accent: 'border-l-red-400', icon: '⛔', iconColor: 'text-red-400' },
};

/** VSCode-style notification card — bottom-right toast, severity-accented. */
export function Toast({ notification, onDismiss }: ToastProps) {
  const s = STYLES[notification.severity] ?? STYLES.info;
  return (
    <div
      className={`pointer-events-auto w-80 rounded-lg border border-white/10 border-l-2 ${s.accent} bg-ink-700/95 px-3.5 py-3 text-sm shadow-xl shadow-black/40 backdrop-blur`}
      style={{ animation: 'toast-in 0.18s ease-out' }}
    >
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 shrink-0 ${s.iconColor}`}>{s.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-100">{notification.title}</p>
          {notification.message && (
            <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-zinc-400">
              {notification.message}
            </p>
          )}
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className="mt-2 rounded-lg bg-clay-500/20 px-3 py-1 text-xs font-semibold text-clay-300 transition-colors hover:bg-clay-500/30"
            >
              {notification.action.label}
            </button>
          )}
        </div>
        {notification.dismissible && (
          <button
            onClick={() => onDismiss(notification.id)}
            className="shrink-0 text-lg leading-none text-zinc-500 transition-colors hover:text-zinc-200"
            title="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
