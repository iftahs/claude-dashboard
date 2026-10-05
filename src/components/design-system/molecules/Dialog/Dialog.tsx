import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useLayoutEffect, useRef } from 'react';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { IconButton } from '@/components/design-system/atoms/IconButton/IconButton';
import { dialogVariants } from './Dialog.variants';
import type { DialogProps } from './types';

export function Dialog({ open, onOpenChange, title, description, children, footer, size, closeLabel = 'Close' }: DialogProps) {
  const describedBy = description ? {} : { 'aria-describedby': undefined };
  const openerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) openerRef.current = document.activeElement;
  }, [open]);

  const returnFocus = (event: Event) => {
    event.preventDefault();
    if (openerRef.current?.isConnected) openerRef.current.focus();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <DialogPrimitive.Content {...describedBy} onCloseAutoFocus={returnFocus} className={dialogVariants({ size })}>
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
