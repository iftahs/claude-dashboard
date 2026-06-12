import type { ReactNode } from 'react';

export interface InfoTipProps {
  /** Explanation shown on hover. */
  text: ReactNode;
  /** Horizontal anchor of the popover relative to the "?" badge. */
  align?: 'left' | 'center' | 'right';
}
