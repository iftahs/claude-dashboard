import type { AnchorHTMLAttributes, ReactNode } from 'react';
import type { IconName } from '@/components/design-system/atoms/Icon/types';

export type StatusChipTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface StatusChipProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'title'> {
  href: string;
  tone?: StatusChipTone;
  icon?: IconName;
  pulse?: boolean;
  tooltip?: ReactNode;
}
