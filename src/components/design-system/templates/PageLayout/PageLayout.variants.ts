import { cva } from 'class-variance-authority';

export const pageLayoutVariants = cva('mx-auto flex w-full min-w-0 flex-1 flex-col gap-6 px-4 pb-8 pt-6 lg:px-8', {
  variants: {
    width: {
      default: 'max-w-content',
      full: 'max-w-none',
    },
  },
  defaultVariants: {
    width: 'default',
  },
});
