import { ConfigProfile } from '@/components/design-system/organisms/ConfigProfile/ConfigProfile';
import { ProjectBreakdown } from '@/components/design-system/organisms/ProjectBreakdown/ProjectBreakdown';
import { TagBreakdown } from '@/components/design-system/organisms/TagBreakdown/TagBreakdown';
import { SessionHistoryTable } from '@/components/design-system/organisms/SessionHistoryTable/SessionHistoryTable';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import { useConfigMode } from '@/hooks/useConfigMode';
import { useSessionPeriod } from '@/hooks/useSessionPeriod';
import { useTags } from '@/hooks/useTags';
import type { SessionMeta, ProjectData } from '@/types';

export function SessionsTab() {
  const { platform, showClaude, source, withSrc } = useSource();
  const { configData, configLoading, isApi } = useConfigMode();
  const sessions = usePolling<SessionMeta[]>(withSrc('/api/sessions'), 10000);
  const projectCosts = usePolling<ProjectData>(withSrc('/api/projects?days=90'), 30000);
  const totalPeriodDays = useSessionPeriod(sessions.data);
  const tags = useTags();

  // The config profile reads ~/.claude's own settings/plan — meaningless under
  // the Codex platform or a Cowork filter, but still worth showing under Both
  // (the Claude half of the view is still Claude Code). Per-project and tag
  // breakdowns need a host project: Cowork sessions run in a sandbox with none,
  // so that filter skips straight to the session log, while Codex threads carry
  // real cwd paths and keep them.
  const showConfig = showClaude && source !== 'cowork';
  const showProjects = source !== 'cowork';

  return (
    <>
      {showProjects && (
        <div className={`grid grid-cols-1 gap-6 ${showConfig ? 'lg:grid-cols-3' : ''}`}>
          {showConfig && (
            <div className="lg:col-span-1 self-start">
              {configData ? (
                <ConfigProfile config={configData} isApi={isApi} />
              ) : configLoading ? (
                <div className="card p-5">
                  <Skeleton className="h-[200px] w-full rounded-2xl" />
                </div>
              ) : null}
            </div>
          )}
          <div className={showConfig ? 'lg:col-span-2' : ''}>
            {sessions.data ? (
              <ProjectBreakdown
                sessions={sessions.data}
                periodDays={totalPeriodDays}
                projectCosts={projectCosts.data?.projects}
                tags={tags}
              />
            ) : sessions.loading ? (
              <div className="card p-5">
                <Skeleton className="h-[200px] w-full rounded-2xl" />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {showProjects && sessions.data && (
        <TagBreakdown
          sessions={sessions.data}
          projectCosts={projectCosts.data?.projects}
          tags={tags}
        />
      )}

      {sessions.data ? (
        <SessionHistoryTable
          sessions={sessions.data}
          periodDays={totalPeriodDays}
          onExport={() => sessions.data ?? []}
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
