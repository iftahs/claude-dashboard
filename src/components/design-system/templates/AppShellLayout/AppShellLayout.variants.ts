import { cva } from 'class-variance-authority';

export const appShellSidebarVariants = cva(
  'relative hidden h-full flex-none flex-col overflow-y-auto overflow-x-hidden border-r border-line bg-surface transition-[width] duration-base ease-emphasized lg:flex',
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

// The slot keeps its final width while the column animates, so the navigation is clipped instead of reflowing.
export const appShellSidebarSlotVariants = cva('flex flex-1 flex-col', {
  variants: {
    collapsed: {
      true: 'w-[calc(theme(spacing.rail)-1px)]',
      false: 'w-[calc(theme(spacing.sidebar)-1px)]',
    },
  },
  defaultVariants: {
    collapsed: false,
  },
});
