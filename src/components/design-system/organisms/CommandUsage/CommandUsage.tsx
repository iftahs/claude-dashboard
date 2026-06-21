import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { compact } from '@/lib/format';
import type { CommandUsageProps } from './types';

export function CommandUsage({ data }: CommandUsageProps) {
  if (!data || data.commands.length === 0) {
    return <div className="text-sm text-zinc-500">No slash commands recorded in this window.</div>;
  }
  const top = data.commands.slice(0, 12);
  const max = top[0]?.count || 1; // `|| 1` guards a 0 max (NaN bar widths)
  return (
    <div>
      <div className="mb-3 text-xs text-zinc-500">
        <span className="font-semibold text-zinc-300">{compact(data.totalCommands)}</span> commands · {data.uniqueCommands} unique
      </div>
      <div className="space-y-2">
        {top.map((c) => {
          const pct = (c.count / max) * 100;
          return (
            <div key={c.command} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate font-mono text-xs text-zinc-400" title={c.command}>
                {c.command}
              </span>
              <div className="flex-1">
                <ProgressBar pct={pct} variant="default" />
              </div>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-300">{compact(c.count)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
