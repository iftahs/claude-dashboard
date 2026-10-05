import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { cn } from '@/lib/cn';
import type { LegendProps } from './types';

export function Legend({ items, ariaLabel = 'Legend', className }: LegendProps) {
  if (items.length === 0) return null;

  return (
    <ul aria-label={ariaLabel} className={cn('flex min-w-0 flex-wrap gap-x-4 gap-y-1', className)}>
      {items.map((item) => (
        <li key={item.key ?? item.label} className="flex">
          <LegendDot color={item.color} shape={item.shape} value={item.value}>
            {item.label}
          </LegendDot>
        </li>
      ))}
    </ul>
  );
}
