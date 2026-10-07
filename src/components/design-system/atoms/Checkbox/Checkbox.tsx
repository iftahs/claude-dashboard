import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { CheckboxProps } from './types';

export function Checkbox({ checked, onCheckedChange, children, disabled = false, className, ...props }: CheckboxProps) {
  return (
    <label
      className={cn(
        'inline-flex min-w-0 items-center gap-2 text-small',
        disabled ? 'cursor-not-allowed text-fg-disabled' : 'cursor-pointer text-fg',
        className,
      )}
    >
      <span className="relative inline-flex size-4 flex-none">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="peer size-4 cursor-pointer appearance-none rounded-tag border border-line-control bg-surface transition-colors duration-fast ease-standard checked:border-accent checked:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-hover"
          {...props}
        />
        <Check
          size={12}
          strokeWidth={2.5}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto hidden text-fg-on-accent peer-checked:block peer-disabled:text-fg-disabled"
        />
      </span>
      <span className="min-w-0">{children}</span>
    </label>
  );
}
