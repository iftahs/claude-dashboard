import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact } from '@/lib/format';
import type { McpBreakdownProps } from './types';

export function McpBreakdown({ data }: McpBreakdownProps) {
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-full rounded" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  const totalCalls = data.builtinCalls + data.mcpCalls;
  const builtinPct = totalCalls > 0 ? (data.builtinCalls / totalCalls) * 100 : 0;
  const mcpPct = 100 - builtinPct;

  return (
    <div className="space-y-4">
      {/* Stacked bar */}
      <div>
        <div className="mb-1.5 flex justify-between text-xs text-zinc-500">
          <span>
            Built-in{' '}
            <span className="font-semibold text-zinc-300">{compact(data.builtinCalls)}</span>
          </span>
          <span>
            MCP{' '}
            <span className="font-semibold text-zinc-300">{compact(data.mcpCalls)}</span>
          </span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full">
          <div
            className="h-full bg-clay-500 transition-all duration-700"
            style={{ width: `${builtinPct}%` }}
          />
          <div
            className="h-full bg-[#6366f1] transition-all duration-700"
            style={{ width: `${mcpPct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
          <span>{builtinPct.toFixed(0)}% built-in</span>
          <span>{mcpPct.toFixed(0)}% MCP</span>
        </div>
      </div>

      {/* Plain-language explanation of what the split means */}
      <p className="text-[11px] leading-relaxed text-zinc-500">
        <span className="text-zinc-400">Built-in</span> = Claude's native tools (Read, Bash, Edit…).{' '}
        <span className="text-zinc-400">MCP</span> = tools from connected MCP servers. Numbers are
        tool-call counts in this window; <span className="text-red-400">errors</span> are calls that
        failed or were rejected.
      </p>

      {/* Per-server table: name · calls · errors, columns aligned */}
      {data.perServer.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-2 border-b border-white/10 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <span className="flex-1">MCP server</span>
            <span className="w-14 text-right">calls</span>
            <span className="w-14 text-right">errors</span>
          </div>
          <div className="space-y-1.5">
            {data.perServer.map((s) => (
              <div key={s.server} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate font-mono text-zinc-400" title={s.server}>
                  {s.server}
                </span>
                <span className="w-14 text-right tabular-nums text-zinc-300">{compact(s.calls)}</span>
                <span
                  className={`w-14 text-right tabular-nums ${s.errors > 0 ? 'text-red-400' : 'text-zinc-600'}`}
                >
                  {s.errors > 0 ? s.errors : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.perServer.length === 0 && data.mcpCalls === 0 && (
        <div className="text-sm text-zinc-500">No MCP tool calls in this window.</div>
      )}
    </div>
  );
}
