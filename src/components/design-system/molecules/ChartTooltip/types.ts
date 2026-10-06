import type { ReactNode } from 'react';

export interface ChartTooltipRow {
  label: string;
  value: string;
  color?: string;
}

export interface ChartTooltipProps {
  rows: readonly ChartTooltipRow[];
  title?: ReactNode;
  footer?: ReactNode;
  className?: string;
}
