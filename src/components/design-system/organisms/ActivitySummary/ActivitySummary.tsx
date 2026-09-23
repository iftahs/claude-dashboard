import { StatCard } from '@/components/design-system/atoms/StatCard/StatCard';
import { StatCardSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import type { ActivitySummaryProps } from './types';
import { summaryCards } from './utils';

/**
 * Lifetime activity row — Lifetime tokens · Peak day · Current streak · Active
 * days — computed from every usage event of the platform on screen. The same four
 * cards on Claude, Codex and Both; these used to be Codex-only profile stats on the
 * Live tab, and now sit on Trends beside the activity heatmap they summarise.
 */
export function ActivitySummary({ summary, loading, platform, codexServerLifetime, scope = '' }: ActivitySummaryProps) {
  if (!summary) {
    if (!loading) return null;
    return (
      <div className="space-y-3">
        <span className="text-xs uppercase tracking-wider text-zinc-500">Activity summary{scope}</span>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }
  if (summary.firstEventTs == null) return null;

  return (
    <div className="space-y-3">
      <span className="text-xs uppercase tracking-wider text-zinc-500">Activity summary{scope} · all history</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards(summary, platform, codexServerLifetime).map((c) => (
          <StatCard
            key={c.key}
            label={c.label}
            value={c.value}
            help={c.help}
            sub={
              <>
                {c.sub}
                {c.extra.map((line) => (
                  <span key={line} className="mt-0.5 block text-xs text-zinc-500">
                    {line}
                  </span>
                ))}
              </>
            }
          />
        ))}
      </div>
    </div>
  );
}
