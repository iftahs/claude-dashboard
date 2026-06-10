import { cva } from 'class-variance-authority';

export const toggleButtonVariants = cva(
  'px-2.5 py-1 text-xs tabular-nums transition-colors',
  {
    variants: {
      active: {
        true: 'bg-clay-500/20 text-clay-400',
        false: 'text-zinc-500 hover:text-zinc-300',
      },
      uppercase: {
        true: 'uppercase font-semibold',
        false: '',
      },
    },
    defaultVariants: {
      active: false,
      uppercase: false,
    },
  }
);
