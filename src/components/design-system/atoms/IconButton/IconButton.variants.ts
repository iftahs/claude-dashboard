import { cva } from 'class-variance-authority';

export const iconButtonVariants = cva(
  'inline-flex flex-none items-center justify-center rounded-control border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:text-fg-disabled',
  {
    variants: {
      variant: {
        ghost: 'border-transparent bg-transparent text-fg-muted enabled:hover:bg-surface-hover enabled:hover:text-fg',
        secondary:
          'border-line-control bg-surface text-fg enabled:hover:bg-surface-hover disabled:border-line disabled:bg-surface-hover',
      },
      size: {
        md: 'size-control',
        sm: 'size-control-sm',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  },
);
