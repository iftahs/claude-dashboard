import { cva } from 'class-variance-authority';

export const segmentedControlVariants = cva(
  'inline-flex flex-none items-stretch gap-0.5 rounded-control border border-line bg-surface-sunken p-0.5',
  {
    variants: {
      size: {
        md: 'h-control',
        sm: 'h-control-sm',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

export const segmentedControlOptionVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-tag border px-2.5 text-small font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  {
    variants: {
      selected: {
        true: 'border-line-strong bg-surface-raised text-fg',
        false: 'border-transparent bg-transparent text-fg-muted hover:text-fg',
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
);
