import { cn } from '@/lib/cn';
import type { ChipProps } from './types';

export function Chip({ color, className, children, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] flex-none items-center gap-1.5 whitespace-nowrap rounded-control border border-line px-2 font-mono text-mono text-fg-muted',
        className,
      )}
      {...props}
    >
      {color ? <span aria-hidden="true" className="size-1.5 flex-none rounded-full" style={{ backgroundColor: color }} /> : null}
      {children}
    </span>
  );
}
