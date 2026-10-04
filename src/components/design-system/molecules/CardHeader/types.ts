import type { ReactNode } from 'react';

export type CardHeaderElement = 'h2' | 'h3';

export interface CardHeaderProps {
  title: string;
  description?: ReactNode;
  help?: ReactNode;
  actions?: ReactNode;
  as?: CardHeaderElement;
  titleId?: string;
  className?: string;
}
