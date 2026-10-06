import { cn } from '@/lib/cn';
import { statusDotVariants } from './StatusDot.variants';
import type { StatusDotProps } from './types';

export function StatusDot({ tone, size, pulse = false, label, className }: StatusDotProps) {
  return (
    <span aria-hidden={label ? undefined : true} className={cn(statusDotVariants({ tone, size, pulse }), className)}>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
