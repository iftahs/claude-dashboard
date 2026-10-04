import { cva } from 'class-variance-authority';

export const tableCellVariants = cva('px-2 align-middle first:pl-4 last:pr-4', {
  variants: {
    header: {
      true: 'h-9 whitespace-nowrap bg-surface-sunken text-label uppercase text-fg-subtle',
      false: 'h-10',
    },
    align: {
      left: 'text-left',
      right: 'text-right',
    },
    numeric: {
      true: '',
      false: '',
    },
    truncate: {
      true: 'w-full max-w-0 truncate',
      false: '',
    },
  },
  compoundVariants: [
    { header: false, numeric: true, className: 'whitespace-nowrap font-mono text-mono text-fg-muted' },
  ],
  defaultVariants: {
    header: false,
    align: 'left',
    numeric: false,
    truncate: false,
  },
});
