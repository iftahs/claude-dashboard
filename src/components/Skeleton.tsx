import type { CSSProperties } from 'react';

/** Base shimmering placeholder. Sizing/rounding come from className. */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

/** Matches StatCard: label, big value, sub line. */
export function StatCardSkeleton() {
  return (
    <div className="card p-5">
      <Skeleton className="h-3 w-32 rounded" />
      <Skeleton className="mt-3 h-8 w-24 rounded" />
      <Skeleton className="mt-3 h-3 w-full rounded-full" />
    </div>
  );
}

/** Matches UsageBarChart's h-[260px] bar chart. */
export function ChartSkeleton({ heightClass = 'h-[260px]' }: { heightClass?: string }) {
  const bars = [55, 80, 40, 95, 65, 50, 85, 60, 90, 45, 70, 35];
  return (
    <div className={`flex w-full items-end gap-2 ${heightClass}`}>
      {bars.map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

/** Matches BlockGauge card: title, ring, detail rows. */
export function GaugeSkeleton() {
  return (
    <div className="card flex flex-col items-center justify-center p-6">
      <Skeleton className="h-3 w-40 rounded" />
      <Skeleton className="mt-4 h-[200px] w-[200px] rounded-full" />
      <div className="mt-5 w-full space-y-2">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}

/** Matches ModelBreakdown: donut + legend list. */
export function DonutSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="h-[200px] w-[200px] shrink-0 rounded-full" />
      <div className="flex-1 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full rounded" />
        ))}
      </div>
    </div>
  );
}

/** Matches ToolUsage: rows of label + bar + count. */
export function BarsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-3 w-24 shrink-0 rounded" />
          <Skeleton className="h-2 flex-1 rounded-full" />
          <Skeleton className="h-3 w-8 shrink-0 rounded" />
        </div>
      ))}
    </div>
  );
}

/** Matches ActivityHeatmap: grid of small day squares. */
export function HeatmapSkeleton({ weeks = 18 }: { weeks?: number }) {
  return (
    <div>
      <Skeleton className="mb-3 h-3 w-48 rounded" />
      <div className="flex gap-1">
        {Array.from({ length: weeks }).map((_, c) => (
          <div key={c} className="flex flex-col gap-1">
            {Array.from({ length: 7 }).map((_, r) => (
              <Skeleton key={r} className="h-3 w-3 rounded-sm" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
