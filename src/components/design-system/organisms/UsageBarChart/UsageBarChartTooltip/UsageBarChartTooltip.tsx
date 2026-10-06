import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
import { PROJECTED_TEXT, ROW_PROJECTED, ROW_TITLE, footerLines, formatValue } from '../utils';
import type { UsageBarChartTooltipProps } from './types';

export function UsageBarChartTooltip({ metric, active, payload }: UsageBarChartTooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !payload || !row) return null;

  const items = payload.map((item) => ({ label: String(item.name ?? ''), value: Number(item.value) || 0, color: item.color }));
  const used = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const footer = footerLines(row, metric);

  return (
    <ChartTooltip
      title={
        <span className="flex items-center gap-1.5">
          {String(row[ROW_TITLE] ?? '')}
          {row[ROW_PROJECTED] === true ? <Badge>{PROJECTED_TEXT}</Badge> : null}
        </span>
      }
      rows={(used.length > 0 ? used : items).map((item) => ({
        label: item.label,
        value: formatValue(item.value, metric),
        color: item.color,
      }))}
      footer={
        footer.length > 0 ? (
          <span className="flex flex-col gap-1">
            {footer.map((line) => (
              <span key={line.label} className="flex items-center justify-between gap-4 whitespace-nowrap">
                {line.label}
                <span className="font-mono text-mono text-fg">{line.value}</span>
              </span>
            ))}
          </span>
        ) : undefined
      }
    />
  );
}
