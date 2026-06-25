import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact } from '@/lib/format';
import { modelColor } from '@/lib/palette';
import type { SubagentStatsPanelProps } from './types';

export function SubagentStatsPanel({ data }: SubagentStatsPanelProps) {
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-32 rounded" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  const { spawns, byType, byModel, avgPerSession, delegationRate } = data;

  const byTypeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const byModelEntries = Object.entries(byModel).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      {/* Big delegation rate */}
      <div>
        <div className="text-xs uppercase tracking-wider text-zinc-500">Delegation rate</div>
        <div className="mt-1 text-4xl font-bold tabular-nums text-[#6366f1]">
          {(delegationRate * 100).toFixed(0)}%
        </div>
        <div className="mt-1 text-sm text-zinc-500">
          of sessions spawned at least one subagent
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-ink-800/50 p-3 ring-1 ring-white/10">
          <div className="text-xs text-zinc-500">Total spawns</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-zinc-200">{compact(spawns)}</div>
        </div>
        <div className="rounded-xl bg-ink-800/50 p-3 ring-1 ring-white/10">
          <div className="text-xs text-zinc-500">Avg per session</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-zinc-200">
            {avgPerSession.toFixed(1)}
          </div>
        </div>
      </div>

      {/* By type */}
      {byTypeEntries.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            By type
          </div>
          <div className="flex flex-wrap gap-2">
            {byTypeEntries.map(([type, count]) => (
              <span key={type} className="flex items-center gap-1.5">
                <Badge variant="info">{type}</Badge>
                <span className="text-xs tabular-nums text-zinc-400">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* By model */}
      {byModelEntries.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            By model
          </div>
          <div className="space-y-1.5">
            {byModelEntries.map(([model, count]) => (
              <div key={model} className="flex items-center justify-between gap-2">
                <LegendDot color={modelColor(model)} label={model} />
                <span className="text-xs tabular-nums text-zinc-300">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
