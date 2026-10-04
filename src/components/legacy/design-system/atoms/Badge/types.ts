import type { ReactNode } from 'react';
import type { VariantProps } from 'class-variance-authority';
import type { badgeVariants } from './Badge.variants';

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
}
