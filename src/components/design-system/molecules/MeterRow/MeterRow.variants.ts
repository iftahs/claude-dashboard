import { cva } from 'class-variance-authority';

export const meterRowLabelVariants = cva('min-w-0 truncate text-fg', {
  variants: {
    size: {
      md: 'text-body',
      sm: 'text-small',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});
