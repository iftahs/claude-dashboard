import type { MouseEvent, ReactNode } from 'react';
import type { IconName } from '@/components/design-system/atoms/Icon/types';

export interface NavItemProps {
  href: string;
  label: string;
  icon: IconName;
  active?: boolean;
  collapsed?: boolean;
  badge?: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
}
