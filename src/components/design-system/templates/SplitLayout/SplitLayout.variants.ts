import { cva } from 'class-variance-authority';

export const splitLayoutVariants = cva('grid min-w-0 grid-cols-1 *:min-w-0', {
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
