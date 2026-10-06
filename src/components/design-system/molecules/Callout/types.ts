import type { HTMLAttributes, ReactNode } from 'react';
import type { IconName } from '@/components/design-system/atoms/Icon/types';

export type CalloutTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export interface CalloutProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: CalloutTone;
  title?: string;
  icon?: IconName;
  action?: ReactNode;
}
