import { cva } from 'class-variance-authority';

export const toastIconVariants = cva('mt-0.5', {
  variants: {
    tone: {
      info: 'text-info-fg',
      success: 'text-success-fg',
      warning: 'text-warning-fg',
      danger: 'text-danger-fg',
    },
  },
});
