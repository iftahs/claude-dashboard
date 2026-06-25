import { AgentActivity } from '@/components/design-system/organisms/AgentActivity/AgentActivity';
import { useLiveData } from '@/hooks/useLiveData';

export function AgentsTab() {
  const { liveSubagents } = useLiveData();
  return <AgentActivity data={liveSubagents.data} loading={liveSubagents.loading} />;
}
