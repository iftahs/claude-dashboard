const STATUS_COLOR: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400',
  in_progress: 'bg-clay-500/15 text-clay-300',
  pending: 'bg-zinc-700/40 text-zinc-400',
  blocked: 'bg-red-500/10 text-red-400',
};

export function statusClass(s: string): string {
  return STATUS_COLOR[s] ?? 'bg-zinc-700/40 text-zinc-400';
}
