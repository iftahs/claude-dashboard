import { cn } from '@/lib/cn';
import { sparklineBarVariants } from './Sparkline.variants';
import type { SparklineProps } from './types';
import { sparklineBarHeights } from './utils';

export function Sparkline({ values, height = 36, highlightLast = false, label, className }: SparklineProps) {
  const lastIndex = values.length - 1;

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
          style={{ height: barHeight }}
        />
      ))}
    </div>
  );
}
