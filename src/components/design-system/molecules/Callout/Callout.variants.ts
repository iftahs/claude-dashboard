import { cva } from 'class-variance-authority';

export const calloutVariants = cva('flex min-w-0 items-start gap-3 rounded-control px-3 py-2.5 text-small', {
  variants: {
    tone: {
      info: 'bg-info-soft text-info-fg',
      success: 'bg-success-soft text-success-fg',
      warning: 'bg-warning-soft text-warning-fg',
      danger: 'bg-danger-soft text-danger-fg',
      neutral: 'bg-surface-hover text-fg-muted',
    },
  },
  defaultVariants: {
    tone: 'info',
  },
});
