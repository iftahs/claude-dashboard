import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex flex-none items-center justify-center gap-1.5 whitespace-nowrap rounded-control border font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-hover disabled:text-fg-disabled',
  {
    variants: {
      variant: {
        primary: 'border-accent bg-accent text-fg-on-accent enabled:hover:border-accent-hover enabled:hover:bg-accent-hover',
        secondary: 'border-line-control bg-surface text-fg enabled:hover:bg-surface-hover',
        ghost: 'border-transparent bg-transparent text-fg-muted enabled:hover:bg-surface-hover enabled:hover:text-fg',
        danger: 'border-danger bg-danger-soft text-danger-fg enabled:hover:bg-danger enabled:hover:text-fg-on-accent',
      },
      size: {
        md: 'h-control px-3 text-body',
        sm: 'h-control-sm px-2.5 text-small',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);
