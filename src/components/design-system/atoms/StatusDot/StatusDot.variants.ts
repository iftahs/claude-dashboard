import { cva } from 'class-variance-authority';

export const statusDotVariants = cva('relative inline-flex flex-none rounded-full', {
  variants: {
    tone: {
      success: 'bg-success text-success',
      warning: 'bg-warning text-warning',
      danger: 'bg-danger text-danger',
      info: 'bg-info text-info',
      accent: 'bg-accent text-accent',
      neutral: 'bg-fg-subtle text-fg-subtle',
    },
    size: {
      sm: 'size-1.5',
      md: 'size-2',
    },
    pulse: {
      true: 'animate-live-ping motion-reduce:animate-none',
      false: '',
    },
  },
  defaultVariants: {
    tone: 'success',
    size: 'md',
    pulse: false,
  },
});
