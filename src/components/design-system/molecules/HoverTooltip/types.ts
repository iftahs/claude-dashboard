import type { ReactNode } from 'react';

export interface HoverTooltipProps {
  children: ReactNode;
  position?: 'above' | 'below';
  /** Horizontal anchor — use 'left'/'right' near container edges to avoid clipping. */
  align?: 'center' | 'left' | 'right';
}
