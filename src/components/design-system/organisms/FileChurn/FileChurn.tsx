import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { compact } from '@/lib/format';
import type { FileChurnProps } from './types';

export function FileChurn({ data }: FileChurnProps) {
  if (!data || data.files.length === 0) {
    return <div className="text-sm text-zinc-500">No file edits in this window.</div>;
  }
  const top = data.files.slice(0, 12);
  const max = top[0]?.edits || 1; // `|| 1` guards a 0 max (NaN bar widths)
  return (
    <div>
      <div className="mb-3 text-xs text-zinc-500">
        <span className="font-semibold text-zinc-300">{compact(data.totalEdits)}</span> edits across {data.uniqueFiles} files
      </div>
      <div className="space-y-2">
        {top.map((f) => {
          const pct = (f.edits / max) * 100;
          return (
            <div key={f.path} className="flex items-center gap-3" title={f.path}>
              <span className="w-40 shrink-0 truncate text-xs text-zinc-300">
                {f.name}
                {f.projectName && <span className="text-zinc-600"> · {f.projectName}</span>}
              </span>
              <div className="flex-1">
                <ProgressBar pct={pct} variant="default" />
              </div>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-300">{f.edits}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
