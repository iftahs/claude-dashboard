import { cva } from 'class-variance-authority';

export const trackVariants = cva('w-full overflow-hidden rounded-full bg-ink-600', {
  variants: {
    height: {
      sm: 'h-1',
      md: 'h-1.5',
    },
  },
  defaultVariants: {
    height: 'md',
  },
});

export const fillVariants = cva('h-full rounded-full transition-all duration-700', {
  variants: {
    variant: {
      default: 'bg-clay-500',
      blue: 'bg-[#0ea5e9]',
      emerald: 'bg-emerald-500',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});
