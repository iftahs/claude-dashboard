import type { ReactNode } from 'react';

export type PageLayoutWidth = 'default' | 'full';

export interface PageLayoutProps {
  header?: ReactNode;
  children: ReactNode;
  width?: PageLayoutWidth;
}
