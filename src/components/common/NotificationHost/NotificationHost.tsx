import { ToastStack } from '@/components/design-system/organisms/ToastStack/ToastStack';
import type { ToastStackItem } from '@/components/design-system/organisms/ToastStack/types';
import { useNotifications } from '@/hooks/useNotifications';
import type { Severity } from '@/hooks/useNotifications';

const TONES: Record<Severity, ToastStackItem['tone']> = { info: 'info', warning: 'warning', error: 'danger' };

export function NotificationHost() {
  const { notifications, dismiss } = useNotifications();

  const items = notifications.map(
    (n): ToastStackItem => ({
      id: n.id,
      tone: TONES[n.severity] ?? 'info',
      title: n.title,
      description: n.content ?? (n.message ? <span className="whitespace-pre-line">{n.message}</span> : undefined),
      action: n.action,
      dismissible: n.dismissible,
    }),
  );

  // The close button fires the notification's own onDismiss (such as "do not show again") before it leaves the stack.
  const handleDismiss = (id: string) => {
    notifications.find((n) => n.id === id)?.onDismiss?.();
    dismiss(id);
  };

  return <ToastStack items={items} onDismiss={handleDismiss} />;
}
