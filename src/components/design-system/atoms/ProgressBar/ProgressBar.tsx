import { cn } from '@/lib/cn';
import { progressBarFillVariants, progressBarTrackVariants } from './ProgressBar.variants';
import type { ProgressBarProps } from './types';
import { clampPercent } from './utils';

export function ProgressBar({ value, tone, size, label, className }: ProgressBarProps) {
  const percent = clampPercent(value);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(progressBarTrackVariants({ size }), className)}
    >
      <div className={progressBarFillVariants({ tone })} style={{ width: `${percent}%` }} />
    </div>
  );
}
