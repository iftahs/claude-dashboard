import type { ReactNode } from 'react';

export type SplitLayoutColumns = 2 | 3;

export type SplitLayoutRatio = 'equal' | '1:2' | '2:1';

export type SplitLayoutGap = 'md' | 'lg';

export type SplitLayoutBreakpoint = 'md' | 'lg' | 'xl';

export interface SplitLayoutProps {
  children: ReactNode;
  columns?: SplitLayoutColumns;
  ratio?: SplitLayoutRatio;
  gap?: SplitLayoutGap;
  collapseBelow?: SplitLayoutBreakpoint;
}
