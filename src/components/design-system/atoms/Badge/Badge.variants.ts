import { cva } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex h-5 flex-none items-center gap-1 whitespace-nowrap rounded-tag px-1.5 text-caption font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-hover text-fg-muted',
        accent: 'bg-accent-soft text-accent-fg',
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
