import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { IconButton } from '@/components/design-system/atoms/IconButton/IconButton';
import { dialogVariants } from './Dialog.variants';
import type { DialogProps } from './types';

export function Dialog({ open, onOpenChange, title, description, children, footer, size, closeLabel = 'Close' }: DialogProps) {
  const describedBy = description ? {} : { 'aria-describedby': undefined };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <DialogPrimitive.Content {...describedBy} className={dialogVariants({ size })}>
          <div className="flex flex-none items-start justify-between gap-4 px-5 pb-3 pt-5">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-heading text-fg">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-0.5 text-small text-fg-muted">{description}</DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label={closeLabel} size="sm" className="-mr-1.5 -mt-1">
                <Icon name="x" />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1 text-body">{children}</div> : null}
          {footer ? (
            <div className="flex flex-none flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
