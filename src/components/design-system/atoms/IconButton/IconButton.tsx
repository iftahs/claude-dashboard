import { forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { iconButtonVariants } from './IconButton.variants';
import type { IconButtonProps } from './types';

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant, size, type = 'button', className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    />
  );
});
