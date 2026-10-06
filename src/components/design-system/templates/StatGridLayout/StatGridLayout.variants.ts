import { cva } from 'class-variance-authority';

export const statGridLayoutVariants = cva('grid min-w-0 gap-4 *:min-w-0', {
  variants: {
    columns: {
      2: 'grid-cols-2',
      3: 'grid-cols-2 md:grid-cols-3',
      4: 'grid-cols-2 lg:grid-cols-4',
      5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
      6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
    },
  },
  defaultVariants: {
    columns: 4,
  },
});
