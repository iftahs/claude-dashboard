import { PageHeader } from '@/components/design-system/atoms/PageHeader/PageHeader';
import { Tabs } from '@/components/design-system/atoms/Tabs/Tabs';
import { ExportMenu } from '@/components/design-system/organisms/ExportMenu/ExportMenu';
import { ProjectBreakdown } from '@/components/design-system/organisms/ProjectBreakdown/ProjectBreakdown';
import { SessionDetail } from '@/components/design-system/organisms/SessionDetail/SessionDetail';
import { SessionSearchStrip } from '@/components/design-system/organisms/SessionSearchStrip/SessionSearchStrip';
import { SessionStatsGrid } from '@/components/design-system/organisms/SessionStatsGrid/SessionStatsGrid';
import { SessionTable } from '@/components/design-system/organisms/SessionTable/SessionTable';
import { TagBreakdown } from '@/components/design-system/organisms/TagBreakdown/TagBreakdown';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { StatGridLayout } from '@/components/design-system/templates/StatGridLayout/StatGridLayout';
import { useSessionsPage } from '@/hooks/useSessionsPage';
import { cn } from '@/lib/cn';

const TABS_ID = 'sessions';
const TABS_LABEL = 'Sessions views';

export function SessionsPage() {
  const page = useSessionsPage();
  const panel = page.tabs
    ? { role: 'tabpanel', id: `${TABS_ID}-panel-${page.view}`, 'aria-labelledby': `${TABS_ID}-tab-${page.view}` }
    : {};

  return (
    <PageLayout
      header={
        <PageHeader description={page.description} actions={<ExportMenu onExport={page.onExport} disabled={page.exportDisabled} />}>
          {page.tabs ? (
            <Tabs id={TABS_ID} ariaLabel={TABS_LABEL} items={page.tabs} value={page.view} onChange={page.onViewChange} />
          ) : null}
        </PageHeader>
      }
    >
      <StatGridLayout>
        <SessionStatsGrid view={page.stats} />
      </StatGridLayout>

      <div
        key={page.view}
        {...panel}
        className={cn('flex min-w-0 flex-col gap-6', page.viewFade.className)}
        onAnimationEnd={page.viewFade.onAnimationEnd}
      >
        {page.view === 'projects' ? (
          <SplitLayout ratio="2:1">
            <ProjectBreakdown view={page.projects} onSortChange={page.onProjectSortChange} onTagsChange={page.onProjectTagsChange} />
            <TagBreakdown view={page.tags} />
          </SplitLayout>
        ) : (
          <>
            <SessionSearchStrip view={page.search} onQueryChange={page.onSearchChange} onOpen={page.onOpenSession} />
            <SessionTable view={page.table} onOpen={page.onOpenSession} onPageChange={page.onPageChange} />
          </>
        )}
      </div>

      <SessionDetail
        view={page.detail}
        transcript={page.transcript}
        onClose={page.onCloseSession}
        onToggleTranscript={page.onToggleTranscript}
        onRetryTranscript={page.onRetryTranscript}
      />
    </PageLayout>
  );
}
