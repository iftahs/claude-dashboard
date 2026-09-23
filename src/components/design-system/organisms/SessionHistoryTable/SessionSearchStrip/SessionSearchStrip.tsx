import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { codexProjectLabel } from '@/lib/project';
import { useSearch } from '@/hooks/useSearch';
import type { SessionSearchStripProps } from './types';

/** Full-text transcript matches for the table's search box, scoped to the selected platform. */
export function SessionSearchStrip({ query, days, onJump, showSourceBadge }: SessionSearchStripProps) {
  const { results, loading } = useSearch(query, days);

  if (query.length < 3) return null;

  if (loading) {
    return (
      <div className="mb-3 rounded-xl bg-ink-700/40 border border-white/10 px-3 py-2 text-xs text-zinc-600">
        Searching transcripts…
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="mb-3 rounded-xl bg-ink-700/40 border border-white/10 px-3 py-2 text-xs text-zinc-600">
        No transcript matches for "{query}"
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-xl bg-ink-700/40 border border-white/10 overflow-hidden">
      <div className="px-3 py-2 border-b border-white/10 text-xs font-semibold text-zinc-400">
        Found in {results.length} session transcript{results.length !== 1 ? 's' : ''}
      </div>
      <div className="divide-y divide-white/10">
        {results.slice(0, 8).map((r) => {
          const project = r.source === 'codex' && r.projectPath ? codexProjectLabel(r.projectPath) : r.project || 'unknown';
          return (
            <button
              key={r.sessionId}
              onClick={() => onJump(r.sessionId)}
              className="w-full text-left px-3 py-2 hover:bg-white/10 transition-colors flex flex-col gap-0.5"
            >
              <div className="flex items-center gap-2 text-xs min-w-0">
                <span className="font-semibold text-zinc-300 truncate">{r.title || project}</span>
                {r.title && <span className="text-zinc-500 truncate flex-none max-w-[40%]">{project}</span>}
                {showSourceBadge && r.source === 'codex' && <Badge variant="info">Codex</Badge>}
                <span className="text-zinc-600 flex-none">{r.date}</span>
                {r.matches > 1 && <span className="text-clay-400 flex-none">{r.matches} matches</span>}
              </div>
              {r.snippet && (
                <p dir="auto" className="text-xs text-zinc-500 line-clamp-1">
                  {r.snippet}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
