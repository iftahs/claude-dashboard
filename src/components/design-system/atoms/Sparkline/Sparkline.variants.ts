import { cva } from 'class-variance-authority';

export const sparklineBarVariants = cva('min-w-0 flex-1 rounded-t-sm', {
  variants: {
    highlighted: {
      true: 'bg-accent',
      false: 'bg-line-strong',
    },
  },
  defaultVariants: {
    highlighted: false,
  },
});
