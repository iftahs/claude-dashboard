import { cn } from '@/lib/cn';
import type { TableProps } from './types';

export function Table({ caption, className, children, ...props }: TableProps) {
  return (
    <table className={cn('w-full border-separate border-spacing-0 text-left text-body tabular-nums text-fg', className)} {...props}>
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      {children}
    </table>
  );
}
