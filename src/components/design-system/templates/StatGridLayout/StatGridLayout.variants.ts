import { cva } from 'class-variance-authority';

// Runs only while the enclosing PageLayout is entering; the delay continues that page's own stagger.
const ENTRANCE =
  '[:where(&>*)]:group-data-[entering]/page:animate-rise-in [&>*]:group-data-[entering]/page:[animation-delay:var(--enter-delay,0ms)] motion-safe:[&>*:nth-child(2)]:group-data-[entering]/page:[animation-delay:calc(var(--enter-delay,0ms)+40ms)] motion-safe:[&>*:nth-child(3)]:group-data-[entering]/page:[animation-delay:calc(var(--enter-delay,0ms)+80ms)] motion-safe:[&>*:nth-child(n+4)]:group-data-[entering]/page:[animation-delay:calc(var(--enter-delay,0ms)+120ms)]';

export const statGridLayoutVariants = cva(`grid min-w-0 gap-4 *:min-w-0 ${ENTRANCE}`, {
  variants: {
    columns: {
      2: 'grid-cols-2',
      3: 'grid-cols-2 md:grid-cols-3',
      4: 'grid-cols-2 lg:grid-cols-4',
      5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
      6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
    },
  },
  defaultVariants: {
    columns: 4,
  },
});
