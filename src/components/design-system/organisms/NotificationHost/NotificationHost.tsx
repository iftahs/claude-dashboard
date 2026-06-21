import { useNotifications } from '@/hooks/useNotifications';
import { Toast } from '@/components/design-system/molecules/Toast/Toast';

/** Fixed bottom-right stack of toast notifications. Rendered once at app root. */
export function NotificationHost() {
  const { notifications, dismiss } = useNotifications();
  if (notifications.length === 0) return null;
  // The × fires the notification's own onDismiss (e.g. persist "don't show
  // again") before removing it from the stack.
  const handleDismiss = (id: string) => {
    const n = notifications.find((x) => x.id === id);
    n?.onDismiss?.();
    dismiss(id);
  };
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2.5">
      {notifications.map((n) => (
        <Toast key={n.id} notification={n} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}
