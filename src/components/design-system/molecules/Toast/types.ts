import type { ReactNode } from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastProps {
  tone: ToastTone;
  title: string;
  description?: ReactNode;
  onDismiss?: () => void;
  action?: ReactNode;
  dismissLabel?: string;
  className?: string;
}
