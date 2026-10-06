import type { ComponentType, ReactNode } from 'react';

export interface ErrorFallbackProps {
  error: Error;
}

export interface ErrorBoundaryProps {
  fallback: ComponentType<ErrorFallbackProps>;
  resetKey?: string;
  children: ReactNode;
}

export interface ErrorBoundaryState {
  error: Error | null;
}
