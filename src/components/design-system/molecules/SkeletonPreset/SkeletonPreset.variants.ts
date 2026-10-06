import { cva } from 'class-variance-authority';

export const skeletonPresetVariants = cva('min-w-0', {
  variants: {
    variant: {
      text: '',
      stat: '',
      chart: 'h-[180px]',
      bars: '',
      table: '',
      gauge: '',
    },
  },
});

export const skeletonPresetShapeVariants = cva('flex', {
  variants: {
    variant: {
      text: 'flex-col gap-3',
      stat: 'flex-col gap-1.5',
      chart: 'h-full items-end gap-1.5',
      bars: 'flex-col gap-4',
      table: 'flex-col',
      gauge: 'flex-col gap-5',
    },
  },
});
