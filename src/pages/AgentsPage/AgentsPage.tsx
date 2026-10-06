import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { PageHeader } from '@/components/design-system/atoms/PageHeader/PageHeader';
import { AgentActivity } from '@/components/design-system/organisms/AgentActivity/AgentActivity';
import { AgentHistoryStrip } from '@/components/design-system/organisms/AgentHistoryStrip/AgentHistoryStrip';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
import { SectionStackLayout } from '@/components/design-system/templates/SectionStackLayout/SectionStackLayout';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { useAgentsPage } from '@/hooks/useAgentsPage';

export function AgentsPage() {
  const { description, activity, history } = useAgentsPage();
  const strips = history.map((view) => <AgentHistoryStrip key={view.platform} view={view} />);

  return (
    <PageLayout header={<PageHeader description={description} />}>
      <SectionStackLayout title={<GroupLabel>Now</GroupLabel>}>
        {activity.map((view) => (
          <AgentActivity key={view.platform} view={view} />
        ))}
      </SectionStackLayout>
      <SectionStackLayout title={<GroupLabel>History</GroupLabel>}>
        {strips.length > 1 ? <SplitLayout>{strips}</SplitLayout> : strips}
      </SectionStackLayout>
    </PageLayout>
  );
}
