import { forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { effortBarLabel } from '../utils';
import type { EffortBarProps } from './types';

export const EffortBar = forwardRef<HTMLDivElement, EffortBarProps>(function EffortBar(
  { slices, size = 'sm', name, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="img"
      aria-label={effortBarLabel(name, slices)}
      className={cn(
        'flex w-full gap-0.5 overflow-hidden rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        size === 'md' ? 'h-3' : 'h-2',
        className,
      )}
      {...props}
    >
      {slices.map((slice) =>
        slice.percent > 0 ? (
          <div key={slice.key} className="h-full" style={{ width: `${slice.percent}%`, backgroundColor: slice.color }} />
        ) : null,
      )}
    </div>
  );
});
