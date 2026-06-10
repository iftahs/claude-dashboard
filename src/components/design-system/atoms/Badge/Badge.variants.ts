import { cva } from 'class-variance-authority';

export const badgeVariants = cva('px-2 py-0.5 rounded-full text-xs font-semibold', {
  variants: {
    variant: {
      success: 'bg-emerald-500/10 text-emerald-400',
      neutral: 'bg-zinc-800 text-zinc-500',
      warning: 'bg-amber-500/10 text-amber-300',
      info: 'bg-ink-600 text-zinc-400',
    },
  },
  defaultVariants: {
    variant: 'neutral',
  },
});
