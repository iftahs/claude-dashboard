import type { ReactNode } from 'react';
import type { IconName } from '@/components/design-system/atoms/Icon/types';

export interface EmptyStateProps {
  title: string;
  icon?: IconName;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}
