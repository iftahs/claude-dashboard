import { cva } from 'class-variance-authority';

export const tabVariants = cva(
  '-mb-px inline-flex h-9 flex-none items-center gap-1.5 whitespace-nowrap border-b-2 bg-transparent text-body font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  {
    variants: {
      selected: {
        true: 'border-accent text-fg',
        false: 'border-transparent text-fg-muted hover:text-fg',
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
);
