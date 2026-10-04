import type { AppNotification } from '@/hooks/useNotifications';

export interface ToastProps {
  notification: AppNotification;
  onDismiss: (id: string) => void;
}
