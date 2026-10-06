import { cn } from '@/lib/cn';
import type { SkeletonProps } from './types';

export function Skeleton({ width, height, className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-tag bg-surface-hover motion-reduce:animate-none', className)}
      style={{ width, height }}
    />
  );
}
