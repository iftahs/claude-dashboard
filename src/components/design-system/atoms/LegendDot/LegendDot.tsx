import { cn } from '@/lib/cn';
import { legendDotSwatchVariants } from './LegendDot.variants';
import type { LegendDotProps } from './types';

export function LegendDot({ color, shape, value, children, className }: LegendDotProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-caption text-fg-muted', className)}>
      <span aria-hidden="true" className={legendDotSwatchVariants({ shape })} style={{ backgroundColor: color }} />
      {children}
      {value !== undefined && value !== null ? <span className="font-mono text-fg">{value}</span> : null}
    </span>
  );
}
