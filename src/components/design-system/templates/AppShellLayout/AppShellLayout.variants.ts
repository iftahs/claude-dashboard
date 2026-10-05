import { cva } from 'class-variance-authority';

export const appShellSidebarVariants = cva(
  'relative hidden h-full flex-none flex-col overflow-y-auto overflow-x-hidden border-r border-line bg-surface lg:flex',
  {
    variants: {
      collapsed: {
        true: 'w-rail',
        false: 'w-sidebar',
      },
    },
    defaultVariants: {
      collapsed: false,
    },
  },
);
