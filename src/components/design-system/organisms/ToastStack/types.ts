import type { ReactNode } from 'react';
import type { ToastTone } from '@/components/design-system/molecules/Toast/types';

export interface ToastStackAction {
  label: string;
  onClick: () => void;
}

export interface ToastStackItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: ReactNode;
  action?: ToastStackAction;
  dismissible?: boolean;
  leaving?: boolean;
}

export interface ToastStackProps {
  items: readonly ToastStackItem[];
  onDismiss: (id: string) => void;
  label?: string;
}
