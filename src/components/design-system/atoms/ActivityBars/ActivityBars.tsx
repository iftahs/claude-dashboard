import { cn } from '@/lib/cn';
import type { ActivityBarsProps } from './types';
import { ACTIVITY_BARS } from './utils';

export function ActivityBars({ className }: ActivityBarsProps) {
  return (
    <span aria-hidden="true" className={cn('inline-flex size-3 flex-none items-end justify-center gap-0.5', className)}>
      {ACTIVITY_BARS.map((bar) => (
        <span
          key={bar.delay}
          style={{ animationDelay: bar.delay, animationFillMode: 'backwards' }}
          className={cn('h-full w-0.5 origin-bottom rounded-full bg-current animate-equalizer motion-reduce:animate-none', bar.rest)}
        />
      ))}
    </span>
  );
}
