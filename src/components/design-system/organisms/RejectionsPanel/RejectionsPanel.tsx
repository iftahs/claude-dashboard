import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact } from '@/lib/format';
import type { RejectionsPanelProps } from './types';

export function RejectionsPanel({ data }: RejectionsPanelProps) {
  if (!data) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-24 shrink-0 rounded" />
            <Skeleton className="h-2 flex-1 rounded-full" />
            <Skeleton className="h-3 w-8 shrink-0 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (data.perTool.length === 0) {
    return (
      <div className="text-sm text-zinc-500">
        No permission rejections in this window.
      </div>
    );
  }

  const maxRejections = Math.max(1, ...data.perTool.map((t) => t.rejections));

  return (
    <div className="space-y-3">
      <div className="text-xs text-zinc-500">
        <span className="font-semibold text-amber-400">{compact(data.total)}</span> permission rejections
      </div>
      <div className="space-y-2.5">
        {data.perTool.map((t) => (
          <div key={t.name} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-xs text-zinc-400" title={t.name}>
              {t.name}
            </span>
            <ProgressBar pct={(t.rejections / maxRejections) * 100} variant="default" />
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-amber-400">
              {t.rejections}
            </span>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-600">
              /{compact(t.calls)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
