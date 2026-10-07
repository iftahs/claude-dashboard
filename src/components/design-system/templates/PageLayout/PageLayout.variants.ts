import { cva } from 'class-variance-authority';

// :where() keeps the entrance at zero specificity, so a row with an animation of its own keeps it.
const ENTRANCE =
  'group/page [:where(&>*)]:data-[entering]:animate-rise-in [&>*]:data-[entering]:[animation-delay:var(--enter-delay,0ms)] motion-safe:[&>*:nth-child(2)]:data-[entering]:[--enter-delay:40ms] motion-safe:[&>*:nth-child(3)]:data-[entering]:[--enter-delay:80ms] motion-safe:[&>*:nth-child(n+4)]:data-[entering]:[--enter-delay:120ms]';

export const pageLayoutVariants = cva(`mx-auto flex w-full min-w-0 flex-1 flex-col gap-6 px-4 pb-8 pt-6 lg:px-8 ${ENTRANCE}`, {
  variants: {
    width: {
      default: 'max-w-content',
      full: 'max-w-none',
    },
  },
  defaultVariants: {
    width: 'default',
  },
});
