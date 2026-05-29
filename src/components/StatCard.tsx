import type { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
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
