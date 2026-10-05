import * as PopoverPrimitive from '@radix-ui/react-popover';
import { CircleQuestionMark } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { InfoTipProps } from './types';

export function InfoTip({ content, label = 'More information', side = 'top', className }: InfoTipProps) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        type="button"
        aria-label={label}
        className={cn(
          'relative inline-flex size-4 flex-none items-center justify-center rounded-full text-fg-subtle after:absolute after:-inset-1 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-[state=open]:text-fg',
          className,
        )}
      >
        <CircleQuestionMark size={14} strokeWidth={1.5} aria-hidden="true" focusable="false" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          aria-label={label}
          className="z-50 max-w-[260px] rounded-control border border-line bg-surface-raised px-3 py-2 text-small tabular-nums text-fg shadow-pop outline-none"
        >
          {content}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
