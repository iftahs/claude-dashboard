import type { ReactNode } from 'react';

export interface ErrorStateProps {
  title: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}
