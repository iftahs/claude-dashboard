import { cn } from '@/lib/cn';
import { badgeVariants } from './Badge.variants';
import type { BadgeProps } from './types';

export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
