import type { ToolShare } from '../types';
import { compact } from '../lib/format';

export function ToolUsage({ tools, totalCalls }: { tools: ToolShare[]; totalCalls: number }) {
  if (tools.length === 0) {
    return <div className="text-sm text-zinc-500">No tool calls in this window.</div>;
  }
  const top = tools.slice(0, 8);
  const max = top[0]?.count ?? 1;

  return (
    <div>
      <div className="mb-3 text-xs text-zinc-500">
        <span className="font-semibold text-zinc-300">{compact(totalCalls)}</span> tool calls · 7d
      </div>
      <div className="space-y-2">
        {top.map((t) => {
          const pct = (t.count / max) * 100;
          return (
            <div key={t.name} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs text-zinc-400" title={t.name}>
                {t.name}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-600">
                <div
                  className="h-full rounded-full bg-clay-500 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-zinc-300">
                {compact(t.count)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
