import { cva } from 'class-variance-authority';

export const aiInsightButton = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 transition-colors',
  {
    variants: {
      state: {
        idle: 'bg-clay-500/10 text-clay-300 ring-clay-500/20 hover:bg-clay-500/20',
        loading: 'bg-clay-500/15 text-clay-300 ring-clay-500/25 cursor-wait',
      },
    },
    defaultVariants: { state: 'idle' },
  },
);
