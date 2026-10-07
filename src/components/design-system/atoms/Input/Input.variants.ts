import { cva } from 'class-variance-authority';

export const inputVariants = cva(
  'w-full min-w-0 rounded-control border bg-surface text-fg placeholder:text-fg-subtle transition-colors duration-fast ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-hover disabled:text-fg-disabled disabled:placeholder:text-fg-disabled',
  {
    variants: {
      size: {
        md: 'h-control px-3 text-body',
        sm: 'h-control-sm px-2.5 text-small',
      },
      invalid: {
        true: 'border-danger',
        false: 'border-line-control',
      },
    },
    defaultVariants: {
      size: 'md',
      invalid: false,
    },
  },
);
