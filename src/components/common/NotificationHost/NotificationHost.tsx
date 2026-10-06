import { Markdown } from '@/components/design-system/atoms/Markdown/Markdown';
import { ToastStack } from '@/components/design-system/organisms/ToastStack/ToastStack';
import type { ToastStackItem } from '@/components/design-system/organisms/ToastStack/types';
import { useExitingItems } from '@/hooks/useExitingItems';
import { useNotifications } from '@/hooks/useNotifications';
import type { Severity } from '@/hooks/useNotifications';

const TONES: Record<Severity, ToastStackItem['tone']> = { info: 'info', warning: 'warning', error: 'danger' };
// As long as the toast's slide-out animation.
const EXIT_MS = 160;

export function NotificationHost() {
  const { notifications, dismiss } = useNotifications();
  const shown = useExitingItems(notifications, EXIT_MS);

  const items = shown.map(
    (n): ToastStackItem => ({
      id: n.id,
      tone: TONES[n.severity] ?? 'info',
      title: n.title,
      description: n.content ?? (n.message ? <Markdown inline text={n.message} className="whitespace-pre-line" /> : undefined),
      action: n.action,
      dismissible: n.dismissible,
      leaving: n.leaving,
    }),
  );

  // The close button fires the notification's own onDismiss (such as "do not show again") before it leaves the stack.
  const handleDismiss = (id: string) => {
    notifications.find((n) => n.id === id)?.onDismiss?.();
    dismiss(id);
  };

  return <ToastStack items={items} onDismiss={handleDismiss} />;
}
