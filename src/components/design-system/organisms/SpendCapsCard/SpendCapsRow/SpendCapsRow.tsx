import { MeterRow } from '@/components/design-system/molecules/MeterRow/MeterRow';
import type { SpendCapsRowProps } from './types';

export function SpendCapsRow({ row }: SpendCapsRowProps) {
  if (row.percent === null) {
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span title={row.label} className="min-w-0 truncate text-body text-fg">
            {row.label}
          </span>
          <span className="flex-none whitespace-nowrap font-mono text-mono text-fg-muted">{row.value}</span>
        </div>
        <span className="text-caption text-fg-subtle">{row.note}</span>
      </div>
    );
  }
  return <MeterRow label={row.label} value={row.value} percent={row.percent} tone={row.tone} note={row.note} />;
}
