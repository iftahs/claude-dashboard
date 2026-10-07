import { cva } from 'class-variance-authority';

export const segmentedControlVariants = cva(
  'relative inline-flex flex-none items-stretch gap-0.5 rounded-control border border-line bg-surface-sunken p-0.5',
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
  'relative inline-flex items-center justify-center whitespace-nowrap rounded-tag border px-2.5 text-small font-medium transition-colors duration-fast ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  {
    variants: {
      selected: {
        true: 'text-fg',
        false: 'border-transparent bg-transparent text-fg-muted hover:text-fg',
      },
      // The sliding thumb draws the selected fill once it has been measured; until then the option draws its own.
      floating: {
        true: 'border-transparent bg-transparent',
        false: '',
      },
    },
    compoundVariants: [{ selected: true, floating: false, className: 'border-line-strong bg-surface-raised' }],
    defaultVariants: {
      selected: false,
      floating: false,
    },
  },
);
