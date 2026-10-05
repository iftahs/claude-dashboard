import { cva } from 'class-variance-authority';

export const keyValueRowValueVariants = cva('flex-none whitespace-nowrap font-mono text-mono', {
  variants: {
    tone: {
      default: 'text-fg',
      muted: 'text-fg-muted',
      success: 'text-success-fg',
      warning: 'text-warning-fg',
      danger: 'text-danger-fg',
      accent: 'text-accent-fg',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
});
