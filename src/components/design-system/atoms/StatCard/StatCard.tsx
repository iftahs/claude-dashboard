import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import type { StatCardProps } from './types';

export function StatCard({ label, value, sub, accent, help }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-500">
        {label}
        {help && <InfoTip text={help} />}
      </div>
      <div
        className="mt-2 text-3xl font-bold tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-sm text-zinc-400">{sub}</div>}
    </div>
  );
}
