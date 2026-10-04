import type { ReactNode } from 'react';

export type SectionStackLayoutSpacing = 'lg' | 'sm';

export interface SectionStackLayoutProps {
  title?: ReactNode;
  children: ReactNode;
  spacing?: SectionStackLayoutSpacing;
}
