import { badgeVariants } from './Badge.variants';
import type { BadgeProps } from './types';

export function Badge({ children, variant }: BadgeProps) {
  return <span className={badgeVariants({ variant })}>{children}</span>;
}
