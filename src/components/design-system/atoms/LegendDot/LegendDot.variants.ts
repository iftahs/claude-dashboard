import { cva } from 'class-variance-authority';

export const dotVariants = cva('rounded-full flex-shrink-0', {
  variants: {
    size: {
      sm: 'h-2 w-2',
      md: 'h-2.5 w-2.5',
    },
  },
  defaultVariants: {
    size: 'sm',
  },
});
