import { useMemo, useState } from 'react';
import { compact, usd } from '@/lib/format';
import { ToggleGroup } from '@/components/design-system/atoms/ToggleGroup/ToggleGroup';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { TagEditor } from '@/components/design-system/molecules/TagEditor/TagEditor';
import { formatDurationMs, sinceLabel } from '../SessionHistoryTable/utils';
import type { ProjectBreakdownProps } from './types';
import { buildProjectStats, projectsHelp, sessionCountLabel } from './utils';

type SortMode = 'cost' | 'time' | 'tokens' | 'files';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'cost', label: 'cost' },
  { value: 'time', label: 'time' },
  { value: 'tokens', label: 'tokens' },
  { value: 'files', label: 'files' },
];

export function ProjectBreakdown({
  sessions,
  since,
  projectCosts,
  tags,
  platform = 'claude',
}: ProjectBreakdownProps) {
  const [sortBy, setSortBy] = useState<SortMode>('cost');

  const stats = useMemo(() => {
    const list = buildProjectStats(sessions, projectCosts);
    if (sortBy === 'cost') list.sort((a, b) => b.cost - a.cost);
    else if (sortBy === 'time') list.sort((a, b) => b.activeMs - a.activeMs);
    else if (sortBy === 'tokens') list.sort((a, b) => b.effectiveTokens - a.effectiveTokens);
    else list.sort((a, b) => b.filesModified - a.filesModified);
    return list;
  }, [sessions, sortBy, projectCosts]);

  const maxVal = useMemo(() => {
    if (stats.length === 0) return 1;
    if (sortBy === 'cost') return Math.max(...stats.map((s) => s.cost), 0.0001);
    if (sortBy === 'time') return Math.max(...stats.map((s) => s.activeMs)) || 1;
    if (sortBy === 'tokens') return Math.max(...stats.map((s) => s.effectiveTokens)) || 1;
    return Math.max(...stats.map((s) => s.filesModified)) || 1;
  }, [stats, sortBy]);

  const sinceText = sinceLabel(since);
  const header = (
    <div>
      <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-zinc-300">
        Projects
        <InfoTip text={projectsHelp(platform)} />
      </h3>
      <p className="text-xs text-zinc-500 mt-0.5">
        Cost, active time, tokens and files per project{sinceText && ` since ${sinceText}`}
      </p>
    </div>
  );

  if (stats.length === 0) {
    return (
      <div className="card p-5 h-full flex flex-col justify-between min-h-[260px]">
        {header}
        <div className="text-center text-zinc-500 text-xs italic py-12 flex-1 flex items-center justify-center">
          No project activity recorded yet
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 flex flex-col h-full">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-none">
        {header}
        <div className="self-start sm:self-center">
          <ToggleGroup options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} uppercase />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[560px]">
        {stats.map((project) => {
          const barVal =
            sortBy === 'cost'
              ? project.cost
              : sortBy === 'time'
              ? project.activeMs
              : sortBy === 'tokens'
              ? project.effectiveTokens
              : project.filesModified;
          const pct = Math.min(100, maxVal > 0 ? (barVal / maxVal) * 100 : 0);

          return (
            <div key={project.path} className="space-y-1">
              <div className="flex justify-between text-xs items-end">
                <span dir="auto" className="font-semibold text-zinc-200 truncate pr-4" title={project.path}>
                  {project.name}
                </span>
                <span className="text-zinc-400 font-mono text-xs shrink-0">
                  {sortBy === 'cost' && (project.cost > 0 ? usd(project.cost) : <span className="text-zinc-600">no cost data</span>)}
                  {sortBy === 'time' && `${formatDurationMs(project.activeMs)} active`}
                  {sortBy === 'tokens' && `${compact(project.effectiveTokens)} tokens`}
                  {sortBy === 'files' && `${project.filesModified} files`}
                </span>
              </div>

              {/* Progress bar uses duration-500 which differs from ProgressBar atom's duration-700 — keep inline */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-600">
                <div className="h-full rounded-full bg-clay-500 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>

              <div className="flex justify-between gap-3 text-xs text-zinc-500 font-mono pt-0.5">
                <span>{sessionCountLabel(project, platform)}</span>
                <span className="shrink-0">
                  {sortBy === 'cost' && project.effectiveTokens > 0
                    ? `${compact(project.effectiveTokens)} tokens`
                    : sortBy === 'tokens' && project.cacheReadTokens > 0
                    ? `+${compact(project.cacheReadTokens)} cache reads`
                    : `+${project.linesAdded.toLocaleString()} / −${project.linesRemoved.toLocaleString()} lines`}
                </span>
              </div>

              {tags && (
                <div className="pt-1">
                  <TagEditor
                    value={tags.tagsFor(project.path)}
                    onChange={(next) => tags.setTagsFor(project.path, next)}
                    suggestions={tags.allTags()}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
