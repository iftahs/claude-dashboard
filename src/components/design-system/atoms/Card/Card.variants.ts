import { cva } from 'class-variance-authority';

export const cardVariants = cva('min-w-0 rounded-card border border-line bg-surface', {
  variants: {
    padding: {
      none: 'p-0',
      sm: 'p-4',
      md: 'p-5',
    },
  },
  defaultVariants: {
    padding: 'md',
  },
});
