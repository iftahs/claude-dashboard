import type { ReactNode } from 'react';

export interface HoverTooltipProps {
  children: ReactNode;
  position?: 'above' | 'below';
}
