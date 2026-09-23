import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { modelColor } from '@/lib/palette';
import { statTiles, typeLabel } from './utils';
import type { SubagentStatsPanelProps } from './types';

export function SubagentStatsPanel({ data, platform }: SubagentStatsPanelProps) {
  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16 w-full rounded" />
          <Skeleton className="h-16 w-full rounded" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  const tiles = statTiles(data, platform);
  const byTypeEntries = Object.entries(data.byType).sort((a, b) => b[1] - a[1]);
  const byModelEntries = Object.entries(data.byModel).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      {/* Stat tiles — counts; the rate lives in the KPI row */}
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-ink-800/50 p-3 ring-1 ring-white/10">
            <div className="text-xs text-zinc-500">{t.label}</div>
            <div className={`mt-1 text-xl font-bold tabular-nums ${t.tone ?? 'text-zinc-200'}`}>{t.value}</div>
          </div>
        ))}
      </div>

      {byTypeEntries.length === 0 && (
        <div className="text-sm text-zinc-500">
          {platform === 'codex' ? 'No guardian reviews or subagents in this window.' : 'No subagents spawned in this window.'}
        </div>
      )}

      {/* By type */}
      {byTypeEntries.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            By type
          </div>
          <div className="flex flex-wrap gap-2">
            {byTypeEntries.map(([type, count]) => (
              <span key={type} className="flex items-center gap-1.5">
                <Badge variant="info">{typeLabel(type)}</Badge>
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
