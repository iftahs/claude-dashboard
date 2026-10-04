import type { HoverTooltipProps } from './types';

export function HoverTooltip({ children, position = 'above', align = 'center' }: HoverTooltipProps) {
  const vertical = position === 'above' ? '-top-8' : '-bottom-8';
  const horizontal =
    align === 'center' ? 'left-1/2 -translate-x-1/2' : align === 'left' ? 'left-0' : 'right-0';

  return (
    <div
      className={`absolute ${vertical} ${horizontal} z-10 pointer-events-none rounded-lg border border-white/10 bg-ink-700 px-2.5 py-1.5 text-[11px] shadow-xl whitespace-nowrap`}
    >
      {children}
    </div>
  );
}
