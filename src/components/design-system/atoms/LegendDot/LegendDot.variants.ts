import { cva } from 'class-variance-authority';

export const legendDotSwatchVariants = cva('size-2 flex-none', {
  variants: {
    shape: {
      square: 'rounded-[2px]',
      round: 'rounded-full',
    },
  },
  defaultVariants: {
    shape: 'square',
  },
});
