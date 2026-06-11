import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact, usd } from '@/lib/format';
import type { BranchBreakdownProps } from './types';

export function BranchBreakdown({ data }: BranchBreakdownProps) {
  if (!data) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-28 shrink-0 rounded" />
            <Skeleton className="h-2 flex-1 rounded-full" />
            <Skeleton className="h-3 w-12 shrink-0 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="text-sm text-zinc-500">No branch data in this window.</div>;
  }

  const maxTokens = Math.max(1, ...data.map((b) => b.effectiveTokens));

  return (
    <div className="space-y-2.5">
      {data.map((b) => (
        <div key={b.branch} className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className="flex-1 truncate font-mono text-xs text-zinc-300"
              title={b.branch}
            >
              {b.branch}
            </span>
            <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums">
              <span className="text-zinc-400">{compact(b.effectiveTokens)}</span>
              <span className="text-zinc-500">{usd(b.cost)}</span>
              <span className="w-10 text-right text-zinc-600">
                {b.sessions}s
              </span>
            </div>
          </div>
          <ProgressBar pct={(b.effectiveTokens / maxTokens) * 100} variant="default" height="sm" />
        </div>
      ))}
    </div>
  );
}
