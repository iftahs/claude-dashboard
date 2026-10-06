import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { PageHeader } from '@/components/design-system/atoms/PageHeader/PageHeader';
import { PluginsInventory } from '@/components/design-system/organisms/PluginsInventory/PluginsInventory';
import { ProfileCard } from '@/components/design-system/organisms/ProfileCard/ProfileCard';
import { TasksPanel } from '@/components/design-system/organisms/TasksPanel/TasksPanel';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
import { SectionStackLayout } from '@/components/design-system/templates/SectionStackLayout/SectionStackLayout';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { useWorkspacePage } from '@/hooks/useWorkspacePage';

export function WorkspacePage() {
  const { description, profiles, inventory, tasks } = useWorkspacePage();
  const sideBySide = profiles.length > 1;
  const profileCards = profiles.map((profile) => <ProfileCard key={profile.key} view={profile} compact={sideBySide} />);

  return (
    <PageLayout header={<PageHeader description={description} />}>
      <SectionStackLayout title={<GroupLabel>{sideBySide ? 'Profiles' : 'Profile'}</GroupLabel>}>
        {sideBySide ? <SplitLayout>{profileCards}</SplitLayout> : profileCards}
      </SectionStackLayout>
      <SectionStackLayout title={<GroupLabel>Integrations</GroupLabel>}>
        <PluginsInventory view={inventory} />
      </SectionStackLayout>
      <SectionStackLayout title={<GroupLabel>Tasks and plans</GroupLabel>}>
        <TasksPanel view={tasks} />
      </SectionStackLayout>
    </PageLayout>
  );
}
