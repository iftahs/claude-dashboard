import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { sparklineBarVariants } from './Sparkline.variants';
import type { SparklineProps } from './types';
import { GROW_DELAY_MS, prefersReducedMotion, sparklineBarHeights } from './utils';

export function Sparkline({ values, height = 36, highlightLast = false, label, className }: SparklineProps) {
  const lastIndex = values.length - 1;
  const [grown, setGrown] = useState(prefersReducedMotion);

  // A timer, not an animation frame: frames stop in a hidden tab and the bars would stay flat.
  useEffect(() => {
    const timer = setTimeout(() => setGrown(true), GROW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('flex items-end gap-1', className)}
      style={{ height }}
    >
      {sparklineBarHeights(values, height).map((barHeight, index) => (
        <div
          key={index}
          className={sparklineBarVariants({ highlighted: highlightLast && index === lastIndex })}
          style={{ height: barHeight, transform: grown ? undefined : 'scaleY(0)' }}
        />
      ))}
    </div>
  );
}
