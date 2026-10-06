import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { PageHeader } from '@/components/design-system/atoms/PageHeader/PageHeader';
import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
import { Tabs } from '@/components/design-system/atoms/Tabs/Tabs';
import { BranchBreakdown } from '@/components/design-system/organisms/BranchBreakdown/BranchBreakdown';
import { CommandUsage } from '@/components/design-system/organisms/CommandUsage/CommandUsage';
import { ComplexityScatter } from '@/components/design-system/organisms/ComplexityScatter/ComplexityScatter';
import { ErrorBreakdown } from '@/components/design-system/organisms/ErrorBreakdown/ErrorBreakdown';
import { FileChurn } from '@/components/design-system/organisms/FileChurn/FileChurn';
import { InsightKpis } from '@/components/design-system/organisms/InsightKpis/InsightKpis';
import { LanguageBreakdown } from '@/components/design-system/organisms/LanguageBreakdown/LanguageBreakdown';
import { McpBreakdown } from '@/components/design-system/organisms/McpBreakdown/McpBreakdown';
import { RejectionsPanel } from '@/components/design-system/organisms/RejectionsPanel/RejectionsPanel';
import { RetryPanel } from '@/components/design-system/organisms/RetryPanel/RetryPanel';
import { SubagentStatsPanel } from '@/components/design-system/organisms/SubagentStatsPanel/SubagentStatsPanel';
import { ToolUsage } from '@/components/design-system/organisms/ToolUsage/ToolUsage';
import { TurnLatency } from '@/components/design-system/organisms/TurnLatency/TurnLatency';
import { YieldPanel } from '@/components/design-system/organisms/YieldPanel/YieldPanel';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
import { SectionStackLayout } from '@/components/design-system/templates/SectionStackLayout/SectionStackLayout';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { StatGridLayout } from '@/components/design-system/templates/StatGridLayout/StatGridLayout';
import { useInsightsPage } from '@/hooks/useInsightsPage';
import { cn } from '@/lib/cn';

const TABS_ID = 'insights';
const TABS_LABEL = 'Insights views';
const RANGE_LABEL = 'Range';
const SUMMARY_LABEL = 'Summary';

export function InsightsPage() {
  const page = useInsightsPage();

  return (
    <PageLayout
      header={
        <PageHeader
          actions={
            <SegmentedControl ariaLabel={RANGE_LABEL} size="sm" options={page.dayOptions} value={page.days} onChange={page.onDaysChange} />
          }
        >
          <Tabs id={TABS_ID} ariaLabel={TABS_LABEL} items={page.viewTabs} value={page.view} onChange={page.onViewChange} />
        </PageHeader>
      }
    >
      <SectionStackLayout title={<GroupLabel note={page.description}>{SUMMARY_LABEL}</GroupLabel>}>
        <StatGridLayout>
          <InsightKpis view={page.kpis} />
        </StatGridLayout>
      </SectionStackLayout>

      <div
        key={page.view}
        role="tabpanel"
        id={`${TABS_ID}-panel-${page.view}`}
        aria-labelledby={`${TABS_ID}-tab-${page.view}`}
        className={cn('flex min-w-0 flex-col gap-6', page.viewFade.className)}
        onAnimationEnd={page.viewFade.onAnimationEnd}
      >
        {page.view === 'reliability' ? (
          <>
            <ErrorBreakdown view={page.errors} />
            <SplitLayout>
              <RejectionsPanel view={page.rejections} />
              <RetryPanel view={page.retries} />
            </SplitLayout>
          </>
        ) : null}

        {page.view === 'tools' ? (
          <>
            <SplitLayout>
              <ToolUsage view={page.tools} />
              <McpBreakdown view={page.mcp} />
            </SplitLayout>
            <SplitLayout>
              <CommandUsage view={page.commands} />
              <SubagentStatsPanel view={page.subagents} />
            </SplitLayout>
          </>
        ) : null}

        {page.view === 'code' ? (
          <>
            <SplitLayout>
              <LanguageBreakdown view={page.languages} />
              <BranchBreakdown view={page.branches} />
            </SplitLayout>
            <SplitLayout>
              <YieldPanel view={page.yield} />
              <FileChurn view={page.churn} />
            </SplitLayout>
          </>
        ) : null}

        {page.view === 'pace' ? (
          <>
            <ComplexityScatter view={page.complexity} />
            <TurnLatency view={page.turns} />
          </>
        ) : null}
      </div>
    </PageLayout>
  );
}
