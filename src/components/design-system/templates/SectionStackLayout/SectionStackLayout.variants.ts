import { cva } from 'class-variance-authority';

// Runs only while the enclosing PageLayout is entering; the delay continues that page's own stagger.
const ENTRANCE =
  '[:where(&>*)]:group-data-[entering]/page:animate-fade-in [&>*]:group-data-[entering]/page:[animation-delay:var(--enter-delay,0ms)] motion-safe:[&>*:nth-child(2)]:group-data-[entering]/page:[animation-delay:calc(var(--enter-delay,0ms)+40ms)] motion-safe:[&>*:nth-child(3)]:group-data-[entering]/page:[animation-delay:calc(var(--enter-delay,0ms)+80ms)] motion-safe:[&>*:nth-child(n+4)]:group-data-[entering]/page:[animation-delay:calc(var(--enter-delay,0ms)+120ms)]';

export const sectionStackLayoutVariants = cva(`flex min-w-0 flex-col ${ENTRANCE}`, {
  variants: {
    spacing: {
      lg: 'gap-6',
      sm: 'gap-3',
    },
  },
  defaultVariants: {
    spacing: 'lg',
  },
});
