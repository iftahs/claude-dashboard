import { cva } from 'class-variance-authority';

export const progressBarTrackVariants = cva('isolate w-full overflow-hidden rounded-full bg-surface-hover', {
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

// A full-width fill slid into the track keeps its round cap, which a scaled fill would squash.
export const progressBarFillVariants = cva('h-full w-full rounded-full transition-transform duration-slow ease-emphasized', {
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
