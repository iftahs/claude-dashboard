import { useEffect } from 'react';
import { ProjectBreakdown } from '@/components/design-system/organisms/ProjectBreakdown/ProjectBreakdown';
import { TagBreakdown } from '@/components/design-system/organisms/TagBreakdown/TagBreakdown';
import { SessionHistoryTable } from '@/components/design-system/organisms/SessionHistoryTable/SessionHistoryTable';
import { StatCard } from '@/components/design-system/atoms/StatCard/StatCard';
import { Skeleton, StatCardSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import { useSessionPeriod } from '@/hooks/useSessionPeriod';
import { useTags } from '@/hooks/useTags';
import type { SessionMeta, ProjectData, SessionSummary } from '@/types';
import { sessionNoun, summaryCards, tagMovesFrom } from './utils';

export function SessionsTab() {
  const { platform, source, withSrc } = useSource();
  const sessions = usePolling<SessionMeta[]>(withSrc('/api/sessions'), 10000);
  const summary = usePolling<SessionSummary>(withSrc('/api/sessions/summary'), 30000);
  // A year of cost, so the rollup covers every listed session (the list is not windowed).
  const projectCosts = usePolling<ProjectData>(withSrc('/api/projects?days=365'), 30000);
  const period = useSessionPeriod(sessions.data);
  const tags = useTags();
  const { migrate } = tags;
  const noun = sessionNoun(platform);

  // Project paths now come from the transcript's real cwd, not Claude Code's lossy
  // folder names; move tags saved under an old path onto its project's new one.
  useEffect(() => {
    const moves = tagMovesFrom(projectCosts.data?.projects);
    if (moves.length) migrate(moves);
  }, [projectCosts.data, migrate]);

  // Per-project and tag breakdowns need a host project: Cowork sessions run in a
  // sandbox with none, so that filter skips straight to the session log. Claude
  // Code and Codex both record the real working directory.
  const showProjects = source !== 'cowork';

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary.data
          ? summaryCards(summary.data, platform).map((c) => (
              <StatCard
                key={c.key}
                label={c.label}
                value={c.value}
                help={c.help}
                sub={
                  <>
                    <span dir="auto" className="block truncate" title={c.sub}>
                      {c.sub}
                    </span>
                    {c.split && <span className="mt-0.5 block text-xs text-zinc-500">{c.split}</span>}
                  </>
                }
              />
            ))
          : [0, 1, 2, 3].map((i) => <StatCardSkeleton key={i} />)}
      </div>

      {showProjects && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {sessions.data ? (
              <ProjectBreakdown
                sessions={sessions.data}
                since={period.since}
                projectCosts={projectCosts.data?.projects}
                tags={tags}
                platform={platform}
              />
            ) : sessions.loading ? (
              <div className="card p-5">
                <Skeleton className="h-[200px] w-full rounded-2xl" />
              </div>
            ) : null}
          </div>
          <div className="lg:col-span-1">
            {sessions.data ? (
              <TagBreakdown sessions={sessions.data} projectCosts={projectCosts.data?.projects} tags={tags} />
            ) : sessions.loading ? (
              <div className="card p-5">
                <Skeleton className="h-[200px] w-full rounded-2xl" />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {sessions.data ? (
        <SessionHistoryTable
          sessions={sessions.data}
          since={period.since}
          periodDays={period.days}
          onExport={() => sessions.data ?? []}
          noun={noun}
          // Under Codex every row is a Codex thread, so the badge would label
          // the whole table rather than distinguish anything in it.
          hideSourceBadge={platform === 'codex'}
        />
      ) : sessions.loading ? (
        <div className="card p-5 space-y-3">
          <Skeleton className="h-5 w-48 rounded" />
          <Skeleton className="h-3 w-72 rounded" />
          <Skeleton className="mt-2 h-[280px] w-full rounded-2xl" />
        </div>
      ) : null}
    </>
  );
}
