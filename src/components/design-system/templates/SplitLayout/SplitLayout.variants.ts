import { cva } from 'class-variance-authority';

// Runs only while the enclosing PageLayout is entering; the delay continues that page's own stagger.
const ENTRANCE =
  '[:where(&>*)]:group-data-[entering]/page:animate-rise-in [&>*]:group-data-[entering]/page:[animation-delay:var(--enter-delay,0ms)] motion-safe:[&>*:nth-child(2)]:group-data-[entering]/page:[animation-delay:calc(var(--enter-delay,0ms)+40ms)] motion-safe:[&>*:nth-child(3)]:group-data-[entering]/page:[animation-delay:calc(var(--enter-delay,0ms)+80ms)] motion-safe:[&>*:nth-child(n+4)]:group-data-[entering]/page:[animation-delay:calc(var(--enter-delay,0ms)+120ms)]';

export const splitLayoutVariants = cva(`grid min-w-0 grid-cols-1 *:min-w-0 ${ENTRANCE}`, {
  variants: {
    columns: {
      2: '',
      3: '',
    },
    ratio: {
      equal: '',
      '1:2': '',
      '2:1': '',
    },
    gap: {
      md: 'gap-4',
      lg: 'gap-6',
    },
    collapseBelow: {
      md: '',
      lg: '',
      xl: '',
    },
  },
  compoundVariants: [
    { columns: 2, ratio: 'equal', collapseBelow: 'md', class: 'md:grid-cols-2' },
    { columns: 2, ratio: '1:2', collapseBelow: 'md', class: 'md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]' },
    { columns: 2, ratio: '2:1', collapseBelow: 'md', class: 'md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' },
    { columns: 3, collapseBelow: 'md', class: 'md:grid-cols-3' },
    { columns: 2, ratio: 'equal', collapseBelow: 'lg', class: 'lg:grid-cols-2' },
    { columns: 2, ratio: '1:2', collapseBelow: 'lg', class: 'lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]' },
    { columns: 2, ratio: '2:1', collapseBelow: 'lg', class: 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' },
    { columns: 3, collapseBelow: 'lg', class: 'lg:grid-cols-3' },
    { columns: 2, ratio: 'equal', collapseBelow: 'xl', class: 'xl:grid-cols-2' },
    { columns: 2, ratio: '1:2', collapseBelow: 'xl', class: 'xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]' },
    { columns: 2, ratio: '2:1', collapseBelow: 'xl', class: 'xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' },
    { columns: 3, collapseBelow: 'xl', class: 'xl:grid-cols-3' },
  ],
  defaultVariants: {
    columns: 2,
    ratio: 'equal',
    gap: 'lg',
    collapseBelow: 'lg',
  },
});
