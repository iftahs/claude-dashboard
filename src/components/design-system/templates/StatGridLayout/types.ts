import type { ReactNode } from 'react';

export type StatGridLayoutColumns = 2 | 3 | 4 | 5 | 6;

export interface StatGridLayoutProps {
  children: ReactNode;
  columns?: StatGridLayoutColumns;
}
