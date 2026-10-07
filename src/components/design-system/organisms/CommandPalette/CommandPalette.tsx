import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { Kbd } from '@/components/design-system/atoms/Kbd/Kbd';
import type { CommandPaletteProps } from './types';

export function CommandPalette({
  open,
  onOpenChange,
  groups,
  title = 'Command palette',
  placeholder = 'Jump to a page or run an action',
  emptyLabel = 'Nothing matches. Try a page name or an action.',
}: CommandPaletteProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 top-[12vh] z-50 mx-auto flex max-h-[min(480px,76vh)] w-[calc(100vw-32px)] max-w-[560px] flex-col overflow-hidden rounded-dialog border border-line bg-surface-raised text-body tabular-nums text-fg shadow-pop outline-none data-[state=closed]:animate-scale-out data-[state=open]:animate-scale-in"
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {/* cmdk's own Ctrl+K binding (previous item) would fight the shortcut that toggles the palette. */}
          <Command label={title} loop vimBindings={false} className="flex min-h-0 flex-1 flex-col">
            <div className="relative flex-none border-b border-line p-2">
              <Icon name="search" className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-fg-subtle" />
              <Command.Input
                autoFocus
                placeholder={placeholder}
                className="h-control w-full min-w-0 rounded-control border border-line-control bg-surface pl-9 pr-3 text-body text-fg placeholder:text-fg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
            </div>
            <Command.List className="min-h-0 flex-1 overflow-y-auto p-2">
              <Command.Empty className="px-2 py-6 text-center text-small text-fg-muted">{emptyLabel}</Command.Empty>
              {groups.map((group) => (
                <Command.Group
                  key={group.id}
                  heading={
                    <GroupLabel as="span" className="px-2 pb-1.5 pt-2">
                      {group.heading}
                    </GroupLabel>
                  }
                >
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.label}
                      keywords={item.keywords ? [...item.keywords] : undefined}
                      onSelect={() => {
                        onOpenChange(false);
                        item.onSelect();
                      }}
                      className="flex h-control cursor-default select-none items-center gap-2 rounded-tag px-2 text-body text-fg-muted data-[selected=true]:bg-surface-hover data-[selected=true]:text-fg"
                    >
                      {item.icon ? <Icon name={item.icon} /> : null}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.current ? <Icon name="check" size={14} /> : null}
                      {item.hint ? <Kbd>{item.hint}</Kbd> : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
            <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-caption text-fg-muted">
              <span className="inline-flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                Move
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>Enter</Kbd>
                Select
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>Esc</Kbd>
                Close
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
