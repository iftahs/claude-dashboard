import { cva } from 'class-variance-authority';

export const dropdownMenuItemVariants = cva(
  'flex h-control cursor-default select-none items-center gap-2 whitespace-nowrap rounded-tag px-2 text-body outline-none data-[disabled]:text-fg-disabled',
  {
    variants: {
      tone: {
        default: 'text-fg-muted data-[highlighted]:bg-surface-hover data-[highlighted]:text-fg',
        danger: 'text-danger-fg data-[highlighted]:bg-danger-soft',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  },
);
