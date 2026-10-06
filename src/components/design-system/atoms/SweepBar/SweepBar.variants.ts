import { cva } from 'class-variance-authority';

export const sweepBarVariants = cva('h-0.5 w-full overflow-hidden rounded-full bg-line', {
  variants: {
    tone: {
      accent: 'text-accent',
      success: 'text-success',
      info: 'text-info',
      neutral: 'text-fg-subtle',
    },
  },
  defaultVariants: {
    tone: 'accent',
  },
});

// Reduced motion swaps the travelling segment for a still, faint line across the whole track.
export const sweepBarSegmentClass =
  'h-full w-2/5 rounded-full bg-gradient-to-r from-transparent via-current to-transparent animate-sweep motion-reduce:w-full motion-reduce:animate-none motion-reduce:bg-current motion-reduce:bg-none motion-reduce:opacity-40';
