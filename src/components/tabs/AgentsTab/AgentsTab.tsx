import { useMemo } from 'react';
import { AgentActivity } from '@/components/design-system/organisms/AgentActivity/AgentActivity';
import {
  CLAUDE_AGENT_TITLE,
  CODEX_AGENTS_HELP,
  CODEX_AGENT_LABELS,
  CODEX_AGENT_TITLE,
  toDisplayAgents,
} from '@/components/design-system/organisms/AgentActivity/utils';
import { useLiveData } from '@/hooks/useLiveData';
import { useSource } from '@/hooks/useSource';

export function AgentsTab() {
  const { platform } = useSource();
  const { liveSubagents, codexAgents } = useLiveData();

  // Full cwd → display label, once per poll result (the 2.5s poll returns a new
  // object each tick; re-mapping on every render would churn the card animations).
  const codex = useMemo(() => toDisplayAgents(codexAgents.data), [codexAgents.data]);

  const codexSection = (
    <AgentActivity
      data={codex}
      loading={codexAgents.loading}
      title={CODEX_AGENT_TITLE}
      help={CODEX_AGENTS_HELP}
      labels={CODEX_AGENT_LABELS}
    />
  );

  if (platform === 'codex') return codexSection;
  if (platform === 'both') {
    return (
      <>
        <AgentActivity data={liveSubagents.data} loading={liveSubagents.loading} title={CLAUDE_AGENT_TITLE} />
        {codexSection}
      </>
    );
  }
  return <AgentActivity data={liveSubagents.data} loading={liveSubagents.loading} />;
}
