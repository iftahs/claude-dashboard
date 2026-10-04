import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { TooltipProps } from './types';

export function Tooltip({ content, children, side = 'top', delay = 300 }: TooltipProps) {
  if (content === null || content === undefined || content === false || content === '') return children;

  return (
    <TooltipPrimitive.Provider delayDuration={delay}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className="z-50 max-w-[260px] rounded-control border border-line bg-surface-raised px-3 py-2 text-small text-fg shadow-pop"
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
