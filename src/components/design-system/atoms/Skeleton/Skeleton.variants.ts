import { cva } from 'class-variance-authority';

export const skeletonVariants = cva('skeleton', {
  variants: {
    rounded: {
      sm: 'rounded-sm',
      md: 'rounded',
      full: 'rounded-full',
    },
  },
  defaultVariants: {
    rounded: 'md',
  },
});
