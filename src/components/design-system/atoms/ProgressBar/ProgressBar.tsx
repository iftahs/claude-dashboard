import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { progressBarFillVariants, progressBarTrackVariants } from './ProgressBar.variants';
import type { ProgressBarProps } from './types';
import { GROW_DELAY_MS, clampPercent, prefersReducedMotion } from './utils';

export function ProgressBar({ value, tone, size, label, className }: ProgressBarProps) {
  const percent = clampPercent(value);
  const [grown, setGrown] = useState(prefersReducedMotion);

  // A timer, not an animation frame: frames stop in a hidden tab and the bar would stay empty.
  useEffect(() => {
    const timer = setTimeout(() => setGrown(true), GROW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(progressBarTrackVariants({ size }), className)}
    >
      <div className={progressBarFillVariants({ tone })} style={{ transform: `translateX(${(grown ? percent : 0) - 100}%)` }} />
    </div>
  );
}
