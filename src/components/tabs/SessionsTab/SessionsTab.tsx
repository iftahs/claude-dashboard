import { ConfigProfile } from '@/components/design-system/organisms/ConfigProfile/ConfigProfile';
import { ProjectBreakdown } from '@/components/design-system/organisms/ProjectBreakdown/ProjectBreakdown';
import { SessionHistoryTable } from '@/components/design-system/organisms/SessionHistoryTable/SessionHistoryTable';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import { useConfigMode } from '@/hooks/useConfigMode';
import { useSessionPeriod } from '@/hooks/useSessionPeriod';
import type { SessionMeta, ProjectData } from '@/types';

export function SessionsTab() {
  const { source, withSrc } = useSource();
  const { configData, configLoading, isApi } = useConfigMode();
  const sessions = usePolling<SessionMeta[]>(withSrc('/api/sessions'), 10000);
  const projectCosts = usePolling<ProjectData>(withSrc('/api/projects?days=90'), 30000);
  const totalPeriodDays = useSessionPeriod(sessions.data);

  return (
    <>
      {/* Config profile + per-project breakdown only make sense for Code.
          Cowork sessions run in a sandbox with no host project, so under
          the Cowork filter we skip straight to the session log. */}
      {source !== 'cowork' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 self-start">
            {configData ? (
              <ConfigProfile config={configData} isApi={isApi} />
            ) : configLoading ? (
              <div className="card p-5">
                <Skeleton className="h-[200px] w-full rounded-2xl" />
              </div>
            ) : null}
          </div>
          <div className="lg:col-span-2">
            {sessions.data ? (
              <ProjectBreakdown
                sessions={sessions.data}
                periodDays={totalPeriodDays}
                projectCosts={projectCosts.data?.projects}
              />
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
          periodDays={totalPeriodDays}
          onExport={() => sessions.data ?? []}
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
