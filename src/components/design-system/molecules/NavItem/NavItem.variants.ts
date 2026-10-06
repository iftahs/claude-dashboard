import { cva } from 'class-variance-authority';

export const navItemVariants = cva(
  'flex h-8 items-center gap-2 rounded-control text-body font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  {
    variants: {
      active: {
        true: 'bg-accent-soft text-accent-fg',
        false: 'text-fg-muted hover:bg-surface-hover hover:text-fg',
      },
      collapsed: {
        true: 'justify-center px-0',
        false: 'px-2',
      },
    },
    defaultVariants: {
      active: false,
      collapsed: false,
    },
  },
);
