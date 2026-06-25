import { cva } from 'class-variance-authority';

// Trailing sidebar chip. Tones mirror the traffic-light / usage palette used
// across the dashboard (clay = neutral live count, usage thresholds, red = needs
// attention) so a single atom covers every nav badge.
export const sidebarBadgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
  {
    variants: {
      tone: {
        clay: 'bg-clay-500/20 text-clay-300',
        success: 'bg-emerald-500/15 text-emerald-300',
        warning: 'bg-amber-500/15 text-amber-300',
        danger: 'bg-red-500/15 text-red-300',
      },
    },
    defaultVariants: {
      tone: 'clay',
    },
  },
);
