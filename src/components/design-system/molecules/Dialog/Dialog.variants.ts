import { cva } from 'class-variance-authority';

export const dialogVariants = cva(
  'fixed inset-0 z-50 m-auto flex h-fit max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] flex-col rounded-dialog border border-line bg-surface-raised text-body tabular-nums text-fg shadow-pop outline-none data-[state=closed]:animate-scale-out data-[state=open]:animate-scale-in',
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
