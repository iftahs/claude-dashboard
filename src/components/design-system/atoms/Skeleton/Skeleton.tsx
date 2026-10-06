import { cn } from '@/lib/cn';
import type { SkeletonProps } from './types';

export function Skeleton({ width, height, className }: SkeletonProps) {
  return (
    <div aria-hidden="true" className={cn('relative overflow-hidden rounded-tag bg-surface-hover', className)} style={{ width, height }}>
      <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-fg/[0.06] to-transparent motion-reduce:hidden" />
    </div>
  );
}
