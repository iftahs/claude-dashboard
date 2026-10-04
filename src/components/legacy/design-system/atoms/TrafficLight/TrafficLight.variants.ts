import { cva } from 'class-variance-authority';

// Agent traffic-light dot. Colors follow the dashboard palette:
// finished → emerald (= Badge success), running → amber, waiting → red.
export const trafficDotVariants = cva('inline-block rounded-full flex-none', {
  variants: {
    status: {
      finished: 'bg-emerald-400',
      running: 'bg-amber-400',
      waiting: 'bg-red-500',
    },
    size: {
      sm: 'h-1.5 w-1.5',
      md: 'h-2 w-2',
    },
  },
  defaultVariants: {
    status: 'running',
    size: 'sm',
  },
});
