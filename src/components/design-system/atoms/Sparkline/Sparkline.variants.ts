import { cva } from 'class-variance-authority';

export const sparklineBarVariants = cva('min-w-0 flex-1 origin-bottom rounded-t-sm transition-transform duration-slow ease-emphasized', {
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
