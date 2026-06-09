import { useMemo, useState } from 'react';
import type { SessionMeta } from '../types';
import { compact } from '../lib/format';

interface ProjectStat {
  path: string;
  name: string;
  totalTimeMinutes: number;
  totalTokens: number;
  effectiveTokens: number;
  cacheReadTokens: number;
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
  sessionCount: number;
}

export function ProjectBreakdown({ sessions, periodDays }: { sessions: SessionMeta[]; periodDays: number }) {
  const [sortBy, setSortBy] = useState<'time' | 'tokens' | 'files'>('time');

  const stats = useMemo(() => {
    const map = new Map<string, ProjectStat>();

    for (const s of sessions) {
      if (!s.project_path) continue;
      const path = s.project_path;

      let stat = map.get(path);
      if (!stat) {
        // Extract leaf folder name
        const parts = path.split(/[\\/]/);
        const name = parts[parts.length - 1] || path;
        stat = {
          path,
          name,
          totalTimeMinutes: 0,
          totalTokens: 0,
          effectiveTokens: 0,
          cacheReadTokens: 0,
          filesModified: 0,
          linesAdded: 0,
          linesRemoved: 0,
          sessionCount: 0,
        };
        map.set(path, stat);
      }

      stat.totalTimeMinutes += s.duration_minutes ?? 0;
      stat.totalTokens += s.total_tokens ?? (s.input_tokens ?? 0) + (s.output_tokens ?? 0);
      stat.effectiveTokens += s.effective_tokens ?? (s.input_tokens ?? 0) + (s.output_tokens ?? 0);
      stat.cacheReadTokens += s.cache_read_tokens ?? 0;
      stat.filesModified += s.files_modified ?? 0;
      stat.linesAdded += s.lines_added ?? 0;
      stat.linesRemoved += s.lines_removed ?? 0;
      stat.sessionCount += 1;
    }

    const list = [...map.values()];

    if (sortBy === 'time') {
      list.sort((a, b) => b.totalTimeMinutes - a.totalTimeMinutes);
    } else if (sortBy === 'tokens') {
      list.sort((a, b) => b.effectiveTokens - a.effectiveTokens);
    } else {
      list.sort((a, b) => b.filesModified - a.filesModified);
    }

    return list;
  }, [sessions, sortBy]);

  const maxVal = useMemo(() => {
    if (stats.length === 0) return 1;
    if (sortBy === 'time') return Math.max(...stats.map((s) => s.totalTimeMinutes)) || 1;
    if (sortBy === 'tokens') return Math.max(...stats.map((s) => s.effectiveTokens)) || 1;
    return Math.max(...stats.map((s) => s.filesModified)) || 1;
  }, [stats, sortBy]);

  if (sessions.length === 0) {
    return (
      <div className="card p-5 h-full flex flex-col justify-between min-h-[260px]">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
            Workspace Analytics · {periodDays}d
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">Summary of activity across development projects</p>
        </div>
        <div className="text-center text-zinc-500 text-xs italic py-12 flex-1 flex items-center justify-center">
          No project workspace telemetry available
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 flex flex-col h-full">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-none">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
            Workspace Analytics · {periodDays}d
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">Summary of activity across development projects</p>
        </div>

        <div className="flex overflow-hidden rounded-lg ring-1 ring-white/10 text-xs self-start sm:self-center">
          {(['time', 'tokens', 'files'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setSortBy(mode)}
              className={`px-2.5 py-1 uppercase font-semibold transition-colors ${
                sortBy === mode
                  ? 'bg-clay-500/20 text-clay-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
        {stats.map((project) => {
          const barVal =
            sortBy === 'time'
              ? project.totalTimeMinutes
              : sortBy === 'tokens'
              ? project.effectiveTokens
              : project.filesModified;

          const pct = Math.min(100, (barVal / maxVal) * 100);

          return (
            <div key={project.path} className="space-y-1">
              <div className="flex justify-between text-xs items-end">
                <span className="font-semibold text-zinc-200 truncate pr-4 animate-fade-in" title={project.path}>
                  {project.name}
                </span>
                <span className="text-zinc-400 font-mono text-xs shrink-0">
                  {sortBy === 'time' && `${project.totalTimeMinutes}m`}
                  {sortBy === 'tokens' && `${compact(project.effectiveTokens)} tokens`}
                  {sortBy === 'files' && `${project.filesModified} files`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-600">
                <div
                  className="h-full rounded-full bg-clay-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Extra stats */}
              <div className="flex justify-between text-xs text-zinc-500 font-mono pt-0.5">
                <span>
                  {project.sessionCount} session{project.sessionCount !== 1 && 's'}
                </span>
                <span>
                  {sortBy === 'tokens' && project.cacheReadTokens > 0
                    ? `+${compact(project.cacheReadTokens)} cache reads`
                    : `+${project.linesAdded} / -${project.linesRemoved} lines`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
