import type { TasksPanelProps } from './types';

const STATUS_COLOR: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400',
  in_progress: 'bg-clay-500/15 text-clay-300',
  pending: 'bg-zinc-700/40 text-zinc-400',
  blocked: 'bg-red-500/10 text-red-400',
};

function statusClass(s: string): string {
  return STATUS_COLOR[s] ?? 'bg-zinc-700/40 text-zinc-400';
}

export function TasksPanel({ data }: TasksPanelProps) {
  if (!data) return <div className="text-sm text-zinc-500">Loading…</div>;
  const { tasks, plans } = data;
  const hasTasks = tasks.total > 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Tasks */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-300">Tasks</span>
          {hasTasks && (
            <span className="text-xs text-zinc-500 tabular-nums">
              {(tasks.completionRate * 100).toFixed(0)}% complete · {tasks.total} total
            </span>
          )}
        </div>
        {hasTasks ? (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {Object.entries(tasks.byStatus).map(([status, n]) => (
                <span key={status} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(status)}`}>
                  {status}: {n}
                </span>
              ))}
            </div>
            <div className="space-y-1.5">
              {tasks.items.slice(0, 12).map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg bg-ink-800/50 px-2.5 py-1.5 text-xs ring-1 ring-white/5">
                  <span className={`flex-none rounded-full px-1.5 py-0.5 text-[10px] ${statusClass(t.blocked ? 'blocked' : t.status)}`}>
                    {t.blocked ? 'blocked' : t.status}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-zinc-300" title={t.subject}>{t.subject}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-600">No tasks tracked.</p>
        )}
      </div>

      {/* Plans */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-300">Plans</span>
          <span className="text-xs text-zinc-500 tabular-nums">{plans.total} total</span>
        </div>
        {plans.items.length > 0 ? (
          <div className="space-y-1.5">
            {plans.items.slice(0, 14).map((p) => (
              <div key={p.name} className="flex items-center gap-2 rounded-lg bg-ink-800/50 px-2.5 py-1.5 text-xs ring-1 ring-white/5">
                <span className="min-w-0 flex-1 truncate text-zinc-300" title={p.title}>{p.title}</span>
                <span className="flex-none tabular-nums text-zinc-600">{(p.sizeBytes / 1024).toFixed(0)}kb</span>
                <span className="flex-none tabular-nums text-zinc-600">{p.ageDays === 0 ? 'today' : `${p.ageDays}d`}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No plans found.</p>
        )}
      </div>
    </div>
  );
}
