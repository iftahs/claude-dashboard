import type { ReactNode } from 'react';

export interface ChartTooltipProps {
  label?: string;
  children: ReactNode;
  minWidth?: number;
}
