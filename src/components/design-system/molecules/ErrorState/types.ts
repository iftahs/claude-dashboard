import type { ReactNode } from 'react';

export interface ErrorStateProps {
  title: string;
  description?: ReactNode;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}
