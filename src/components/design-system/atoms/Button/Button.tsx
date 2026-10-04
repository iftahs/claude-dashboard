import { forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { buttonVariants } from './Button.variants';
import type { ButtonProps } from './types';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, type = 'button', className, ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
