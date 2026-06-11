import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { compact } from '@/lib/format';
import type { LanguageBreakdownProps } from './types';

export function LanguageBreakdown({ data }: LanguageBreakdownProps) {
  if (!data) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-20 shrink-0 rounded" />
            <Skeleton className="h-2 flex-1 rounded-full" />
            <Skeleton className="h-3 w-8 shrink-0 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="text-sm text-zinc-500">No file edits in this window.</div>;
  }

  const maxEdits = Math.max(1, ...data.map((l) => l.edits));

  return (
    <div className="space-y-2.5">
      {data.slice(0, 10).map((lang) => (
        <div key={lang.language} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-zinc-400">{lang.language}</span>
          <ProgressBar pct={(lang.edits / maxEdits) * 100} variant="default" />
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-300">
            {compact(lang.edits)}
          </span>
          {lang.reads > 0 && (
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-600">
              {compact(lang.reads)}r
            </span>
          )}
        </div>
      ))}
      <div className="mt-1 text-[10px] text-zinc-600">edits &nbsp;·&nbsp; reads shown dimmed</div>
    </div>
  );
}
