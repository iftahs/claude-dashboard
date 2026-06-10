import type { ChartTooltipProps } from './types';

export function ChartTooltip({ label, children, minWidth }: ChartTooltipProps) {
  return (
    <div
      className="rounded-xl border border-white/10 bg-[#131318] p-3 shadow-2xl text-[12px]"
      style={minWidth !== undefined ? { minWidth } : undefined}
    >
      {label !== undefined && (
        <div className="mb-2 font-semibold text-zinc-400">{label}</div>
      )}
      {children}
    </div>
  );
}
