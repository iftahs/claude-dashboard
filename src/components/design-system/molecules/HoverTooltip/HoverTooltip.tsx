import type { HoverTooltipProps } from './types';

export function HoverTooltip({ children, position = 'above' }: HoverTooltipProps) {
  const positionClass =
    position === 'above'
      ? 'absolute -top-8 left-1/2 -translate-x-1/2'
      : 'absolute -bottom-8 left-1/2 -translate-x-1/2';

  return (
    <div
      className={`${positionClass} z-10 pointer-events-none rounded-lg border border-white/10 bg-ink-700 px-2.5 py-1.5 text-[11px] shadow-xl whitespace-nowrap`}
    >
      {children}
    </div>
  );
}
