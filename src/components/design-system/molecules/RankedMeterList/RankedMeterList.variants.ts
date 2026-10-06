import { cva } from 'class-variance-authority';

export const rankedMeterValueVariants = cva('whitespace-nowrap text-right font-mono text-mono tabular-nums', {
  variants: {
    tone: {
      default: 'text-fg',
      muted: 'text-fg-muted',
      subtle: 'text-fg-subtle',
      success: 'text-success-fg',
      warning: 'text-warning-fg',
      danger: 'text-danger-fg',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
});

export const rankedMeterLabelVariants = cva('min-w-0 truncate text-fg-muted', {
  variants: {
    mono: {
      true: 'font-mono text-mono',
      false: 'text-small',
    },
  },
  defaultVariants: {
    mono: false,
  },
});
