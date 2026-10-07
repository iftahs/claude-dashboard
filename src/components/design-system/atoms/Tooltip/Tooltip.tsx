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
            className="z-50 max-w-[260px] origin-[var(--radix-tooltip-content-transform-origin)] rounded-control border border-line bg-surface-raised px-3 py-2 text-small tabular-nums text-fg shadow-pop data-[state=closed]:animate-scale-out data-[state=delayed-open]:animate-scale-in"
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
