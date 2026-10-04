import { cva } from 'class-variance-authority';

export const progressBarTrackVariants = cva('w-full overflow-hidden rounded-full bg-surface-hover', {
  variants: {
    size: {
      sm: 'h-1',
      md: 'h-1.5',
      lg: 'h-2',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export const progressBarFillVariants = cva('h-full rounded-full', {
  variants: {
    tone: {
      accent: 'bg-accent',
      warning: 'bg-warning',
      danger: 'bg-danger',
      success: 'bg-success',
      neutral: 'bg-fg-subtle',
      codex: 'bg-platform-codex',
    },
  },
  defaultVariants: {
    tone: 'accent',
  },
});
