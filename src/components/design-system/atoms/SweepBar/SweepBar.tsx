import { cn } from '@/lib/cn';
import { sweepBarSegmentClass, sweepBarVariants } from './SweepBar.variants';
import type { SweepBarProps } from './types';

export function SweepBar({ tone, label = 'Running', className }: SweepBarProps) {
  return (
    <div role="progressbar" aria-label={label} className={cn(sweepBarVariants({ tone }), className)}>
      <div className={sweepBarSegmentClass} />
    </div>
  );
}
