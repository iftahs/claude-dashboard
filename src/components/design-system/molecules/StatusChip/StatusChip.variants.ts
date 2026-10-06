import { cva } from 'class-variance-authority';

export const statusChipVariants = cva(
  'inline-flex h-control-sm flex-none items-center gap-1.5 whitespace-nowrap rounded-control px-2 text-small font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-hover text-fg-muted hover:text-fg',
        success: 'bg-success-soft text-success-fg',
        warning: 'bg-warning-soft text-warning-fg',
        danger: 'bg-danger-soft text-danger-fg',
        info: 'bg-info-soft text-info-fg',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);
