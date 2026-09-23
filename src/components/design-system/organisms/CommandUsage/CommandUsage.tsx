import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { BarsSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact } from '@/lib/format';
import type { CommandUsageProps } from './types';

// A badge marks skill rows — slash commands count invocations, skills count sessions that ran them.
export function CommandUsage({ data, emptyText = 'No slash commands or skills recorded in this window.' }: CommandUsageProps) {
  if (!data) return <BarsSkeleton rows={5} />;
  if (data.commands.length === 0) {
    return <div className="text-sm text-zinc-500">{emptyText}</div>;
  }
  const top = data.commands.slice(0, 12);
  const max = top[0]?.count || 1; // `|| 1` guards a 0 max (NaN bar widths)
  return (
    <div>
      <div className="mb-3 text-xs text-zinc-500">
        <span className="font-semibold text-zinc-300">{compact(data.slashCommands)}</span> slash commands ·{' '}
        <span className="font-semibold text-zinc-300">{compact(data.skillSessions)}</span> skill sessions ·{' '}
        {data.uniqueCommands} unique
      </div>
      <div className="space-y-2">
        {top.map((c) => {
          const pct = (c.count / max) * 100;
          return (
            <div key={`${c.kind}:${c.command}`} className="flex items-center gap-3">
              <span className="flex w-40 shrink-0 items-center gap-1.5" title={c.command}>
                <span className="truncate font-mono text-xs text-zinc-400">{c.command}</span>
                {c.kind === 'skill' && <Badge variant="info">skill</Badge>}
              </span>
              <div className="flex-1">
                <ProgressBar pct={pct} variant={c.kind === 'skill' ? 'blue' : 'default'} />
              </div>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-300">{compact(c.count)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
