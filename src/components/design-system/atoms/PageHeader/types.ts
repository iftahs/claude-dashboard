import type { ReactNode } from 'react';

export interface PageHeaderProps {
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}
