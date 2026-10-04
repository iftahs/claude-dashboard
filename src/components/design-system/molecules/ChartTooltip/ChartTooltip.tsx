import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { cn } from '@/lib/cn';
import type { ChartTooltipProps } from './types';

export function ChartTooltip({ rows, title, footer, className }: ChartTooltipProps) {
  return (
    <div
      className={cn(
        'flex min-w-[160px] flex-col gap-1.5 rounded-control border border-line bg-surface-raised px-3 py-2 shadow-pop',
        className,
      )}
    >
      {title ? <div className="whitespace-nowrap text-small font-medium text-fg">{title}</div> : null}
      {rows.length > 0 ? (
        <div className="flex flex-col gap-1">
          {rows.map((row, index) => (
            <div key={`${index}-${row.label}`} className="flex items-center justify-between gap-4">
              {row.color ? (
                <LegendDot color={row.color}>{row.label}</LegendDot>
              ) : (
                <span className="whitespace-nowrap text-caption text-fg-muted">{row.label}</span>
              )}
              <span className="whitespace-nowrap text-right font-mono text-mono tabular-nums text-fg">{row.value}</span>
            </div>
          ))}
        </div>
      ) : null}
      {footer ? <div className="border-t border-line pt-1.5 text-caption text-fg-subtle">{footer}</div> : null}
    </div>
  );
}
