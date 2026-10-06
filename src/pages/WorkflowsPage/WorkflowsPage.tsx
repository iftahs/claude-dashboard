import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { PageHeader } from '@/components/design-system/atoms/PageHeader/PageHeader';
import { Callout } from '@/components/design-system/molecules/Callout/Callout';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { WorkflowRunCard } from '@/components/design-system/organisms/WorkflowRunCard/WorkflowRunCard';
import { WorkflowRunRow } from '@/components/design-system/organisms/WorkflowRunRow/WorkflowRunRow';
import { WorkflowStatsGrid } from '@/components/design-system/organisms/WorkflowStatsGrid/WorkflowStatsGrid';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
import { SectionStackLayout } from '@/components/design-system/templates/SectionStackLayout/SectionStackLayout';
import { StatGridLayout } from '@/components/design-system/templates/StatGridLayout/StatGridLayout';
import { useWorkflowsPage } from '@/hooks/useWorkflowsPage';

const RUNS_TITLE = 'Workflow runs';
const HELP_LABEL = 'About workflows';

export function WorkflowsPage() {
  const { description, help, note, stats, runs, onSelectPhase, onToggleRun, onToggleAgent, onRetryAgent } = useWorkflowsPage();

  return (
    <PageLayout
      header={
        <PageHeader
          description={
            <>
              {description} <InfoTip label={HELP_LABEL} content={help} side="bottom" className="align-text-bottom" />
            </>
          }
        />
      }
    >
      {note ? <Callout tone="neutral">{note}</Callout> : null}

      {stats.status === 'hidden' ? null : (
        <StatGridLayout columns={5}>
          <WorkflowStatsGrid view={stats} />
        </StatGridLayout>
      )}

      {runs.state ? <Section title={RUNS_TITLE} state={runs.state} /> : null}

      {runs.live.length > 0 ? (
        <SectionStackLayout title={<GroupLabel note={runs.liveNote}>Live</GroupLabel>}>
          {runs.live.map((run) => (
            <WorkflowRunCard
              key={run.runId}
              view={run}
              onSelectPhase={onSelectPhase}
              onToggleAgent={onToggleAgent}
              onRetryAgent={onRetryAgent}
            />
          ))}
        </SectionStackLayout>
      ) : null}

      {runs.groups.map((group) => (
        <SectionStackLayout key={group.label} spacing="sm" title={<GroupLabel>{group.label}</GroupLabel>}>
          {group.runs.map((run) => (
            <WorkflowRunRow
              key={run.runId}
              view={run}
              onToggle={onToggleRun}
              onSelectPhase={onSelectPhase}
              onToggleAgent={onToggleAgent}
              onRetryAgent={onRetryAgent}
            />
          ))}
        </SectionStackLayout>
      ))}
    </PageLayout>
  );
}
