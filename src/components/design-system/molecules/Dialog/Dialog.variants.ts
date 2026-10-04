import { cva } from 'class-variance-authority';

export const dialogVariants = cva(
  'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-dialog border border-line bg-surface-raised text-fg shadow-pop outline-none',
  {
    variants: {
      size: {
        sm: 'max-w-[400px]',
        md: 'max-w-[520px]',
        lg: 'max-w-[720px]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);
