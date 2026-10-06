import { cva } from 'class-variance-authority';

export const sectionStackLayoutVariants = cva('flex min-w-0 flex-col', {
  variants: {
    spacing: {
      lg: 'gap-6',
      sm: 'gap-3',
    },
  },
  defaultVariants: {
    spacing: 'lg',
  },
});
