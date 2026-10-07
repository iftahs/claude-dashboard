import { cva } from 'class-variance-authority';

export const tableRowVariants = cva('[&>*]:border-t [&>*]:border-line [thead_&>*]:border-t-0', {
  variants: {
    state: {
      default: '',
      selected: 'bg-accent-soft text-accent-fg',
    },
    interactive: {
      true: 'cursor-pointer transition-colors duration-fast ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
      false: '',
    },
  },
  compoundVariants: [{ state: 'default', interactive: true, className: 'hover:bg-surface-hover' }],
  defaultVariants: {
    state: 'default',
    interactive: false,
  },
});
