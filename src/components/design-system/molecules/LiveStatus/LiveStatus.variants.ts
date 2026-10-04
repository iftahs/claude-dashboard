import { cva } from 'class-variance-authority';

export const liveStatusVariants = cva('inline-flex flex-none items-center gap-1.5 whitespace-nowrap text-caption', {
  variants: {
    state: {
      live: 'text-fg-muted',
      paused: 'text-fg-muted',
      error: 'text-danger-fg',
    },
  },
  defaultVariants: {
    state: 'live',
  },
});
