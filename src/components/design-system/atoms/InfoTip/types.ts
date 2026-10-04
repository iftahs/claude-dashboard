import type { ReactNode } from 'react';

export type InfoTipSide = 'top' | 'right' | 'bottom' | 'left';

export interface InfoTipProps {
  content: ReactNode;
  label?: string;
  side?: InfoTipSide;
  className?: string;
}
