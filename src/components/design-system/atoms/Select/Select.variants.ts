import { cva } from 'class-variance-authority';

export const selectTriggerVariants = cva(
  'inline-flex min-w-0 items-center justify-between gap-3 whitespace-nowrap rounded-control border border-line-control bg-surface text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-hover disabled:text-fg-disabled data-[placeholder]:text-fg-subtle disabled:data-[placeholder]:text-fg-disabled',
  {
    variants: {
      size: {
        md: 'h-control px-3 text-body',
        sm: 'h-control-sm px-2.5 text-small',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

export const selectItemVariants = cva(
  'flex cursor-default select-none items-center justify-between gap-3 whitespace-nowrap rounded-tag px-2 text-fg-muted outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-fg data-[state=checked]:text-fg data-[disabled]:text-fg-disabled',
  {
    variants: {
      size: {
        md: 'h-control text-body',
        sm: 'h-control-sm text-small',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);
