import { forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { inputVariants } from './Input.variants';
import type { InputProps } from './types';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size, invalid = false, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputVariants({ size, invalid }), className)}
      {...props}
    />
  );
});
