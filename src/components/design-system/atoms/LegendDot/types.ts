import type { ReactNode } from 'react';

export type LegendDotShape = 'square' | 'round';

export interface LegendDotProps {
  color: string;
  shape?: LegendDotShape;
  value?: ReactNode;
  children?: ReactNode;
  className?: string;
}
