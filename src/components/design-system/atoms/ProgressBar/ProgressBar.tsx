import { trackVariants, fillVariants } from './ProgressBar.variants';
import type { ProgressBarProps } from './types';

export function ProgressBar({ pct, color, variant, height, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className={trackVariants({ height, className })}>
      <div
        className={fillVariants({ variant: color ? null : variant })}
        style={{
          width: `${clamped}%`,
          ...(color ? { background: color } : {}),
        }}
      />
    </div>
  );
}
