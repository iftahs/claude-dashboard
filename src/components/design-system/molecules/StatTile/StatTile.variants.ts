import { cva } from 'class-variance-authority';

export const statTileVariants = cva('flex flex-col', {
  variants: {
    size: {
      md: 'gap-1.5',
      sm: 'gap-1 p-3',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export const statTileValueVariants = cva('whitespace-nowrap tabular-nums', {
  variants: {
    tone: {
      default: 'text-fg',
      success: 'text-success-fg',
      warning: 'text-warning-fg',
      danger: 'text-danger-fg',
      accent: 'text-accent-fg',
    },
    size: {
      md: 'text-metric',
      sm: 'text-heading',
    },
  },
  defaultVariants: {
    tone: 'default',
    size: 'md',
  },
});
