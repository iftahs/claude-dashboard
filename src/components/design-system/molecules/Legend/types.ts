import type { ReactNode } from 'react';
import type { LegendDotShape } from '@/components/design-system/atoms/LegendDot/types';

export interface LegendItem {
  label: string;
  color: string;
  value?: ReactNode;
  shape?: LegendDotShape;
  key?: string;
}

export interface LegendProps {
  items: readonly LegendItem[];
  ariaLabel?: string;
  className?: string;
}
