import { MeterRow } from '@/components/design-system/molecules/MeterRow/MeterRow';
import type { LimitGlanceCapProps } from './types';

export function LimitGlanceCap({ row }: LimitGlanceCapProps) {
  if (row.percent === null) {
    return (
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <span title={row.label} className="min-w-0 truncate text-body text-fg">
          {row.label}
        </span>
        <span className="flex flex-none items-baseline gap-2 whitespace-nowrap">
          <span className="font-mono text-mono text-fg-muted">{row.value}</span>
          <span className="text-caption text-fg-subtle">{row.note}</span>
        </span>
      </div>
    );
  }
  return <MeterRow label={row.label} value={row.value} percent={row.percent} tone={row.tone} note={row.note} />;
}
