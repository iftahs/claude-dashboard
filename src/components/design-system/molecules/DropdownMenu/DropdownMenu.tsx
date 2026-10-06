import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { dropdownMenuItemVariants } from './DropdownMenu.variants';
import type { DropdownMenuProps } from './types';

export function DropdownMenu({ trigger, items, align = 'start' }: DropdownMenuProps) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          sideOffset={4}
          collisionPadding={8}
          className="z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[180px] overflow-y-auto rounded-control border border-line bg-surface-raised p-1 text-body tabular-nums text-fg shadow-pop"
        >
          {items.map((item) => (
            <DropdownMenuPrimitive.Item
              key={item.key}
              disabled={item.disabled}
              onSelect={() => item.onSelect()}
              className={dropdownMenuItemVariants({ tone: item.tone })}
            >
              {item.icon ? <Icon name={item.icon} /> : null}
              {item.label}
            </DropdownMenuPrimitive.Item>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
