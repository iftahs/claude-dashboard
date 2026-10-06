import { cva } from 'class-variance-authority';

export const settingRowVariants = cva('flex min-w-0 flex-col gap-3', {
  variants: {
    layout: {
      inline: 'md:flex-row md:items-start md:justify-between md:gap-6',
      stacked: '',
    },
  },
  defaultVariants: {
    layout: 'inline',
  },
});

export const settingRowControlVariants = cva('flex min-w-0 flex-col gap-2', {
  variants: {
    layout: {
      inline: 'items-start md:flex-none md:items-end',
      stacked: '',
    },
  },
  defaultVariants: {
    layout: 'inline',
  },
});
