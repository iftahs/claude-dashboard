import { WorkflowsView } from '@/components/design-system/organisms/WorkflowsView/WorkflowsView';
import { useLiveData } from '@/hooks/useLiveData';

export function WorkflowsTab() {
  const { workflows } = useLiveData();
  return <WorkflowsView data={workflows.data} loading={workflows.loading} />;
}
