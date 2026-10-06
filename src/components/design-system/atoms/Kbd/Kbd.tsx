import { cn } from '@/lib/cn';
import type { KbdProps } from './types';

export function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 flex-none items-center whitespace-nowrap rounded-tag border border-line bg-surface-sunken px-[5px] font-mono text-mono text-fg-muted',
        className,
      )}
      {...props}
    />
  );
}
