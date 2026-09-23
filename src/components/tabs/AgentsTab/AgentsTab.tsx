import { useMemo } from 'react';
import { AgentActivity } from '@/components/design-system/organisms/AgentActivity/AgentActivity';
import {
  AGENT_TITLE,
  CLAUDE_AGENTS_HELP,
  CLAUDE_AGENT_LABELS,
  CODEX_AGENTS_HELP,
  CODEX_AGENT_LABELS,
  toDisplayAgents,
} from '@/components/design-system/organisms/AgentActivity/utils';
import { AgentHistoryStrip } from '@/components/design-system/organisms/AgentHistoryStrip/AgentHistoryStrip';
import { AGENT_HISTORY_DAYS, historyHelp } from '@/components/design-system/organisms/AgentHistoryStrip/utils';
import { PLATFORM_NOUN, titleScope } from '@/lib/platform';
import { useLiveData } from '@/hooks/useLiveData';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import type { SubagentStats } from '@/types';

const HISTORY_POLL_MS = 60_000;

/**
 * One layout for every platform: a "last 30 days" strip (so the tab says something
 * when nothing runs), then the live activity section. Under Both, each platform gets
 * the same two components — strips side by side, live sections stacked.
 *
 * Both feeds are platform-scoped, never surface-scoped: the Claude live feed reads
 * Claude Code transcripts whatever the Code/Cowork toggle says, so the history strip
 * asks for `source=claude` explicitly to match.
 */
export function AgentsTab() {
  const { platform, showClaude, showCodex } = useSource();
  const { liveSubagents, codexAgents } = useLiveData();

  // Full cwd → display label, once per poll result (the 2.5s poll returns a new
  // object each tick; re-mapping on every render would churn the card animations).
  const claude = useMemo(() => toDisplayAgents(liveSubagents.data), [liveSubagents.data]);
  const codex = useMemo(() => toDisplayAgents(codexAgents.data), [codexAgents.data]);

  const claudeHistory = usePolling<SubagentStats>(
    showClaude ? `/api/insights/subagents?days=${AGENT_HISTORY_DAYS}&source=claude` : '',
    HISTORY_POLL_MS,
  );
  const codexHistory = usePolling<SubagentStats>(
    showCodex ? `/api/insights/subagents?days=${AGENT_HISTORY_DAYS}&source=codex` : '',
    HISTORY_POLL_MS,
  );

  // Titles name the platform the way every other tab does (titleScope: nothing under
  // Claude, " · Codex" under Codex); under Both each section names its own platform.
  const scope = (p: 'claude' | 'codex') => (platform === 'both' ? ` · ${PLATFORM_NOUN[p]}` : titleScope(platform));
  const historyTitle = (p: 'claude' | 'codex') => `Subagents · last ${AGENT_HISTORY_DAYS} days${scope(p)}`;
  const sideBySide = platform === 'both';

  return (
    <>
      <div className={sideBySide ? 'grid grid-cols-1 gap-6 lg:grid-cols-2' : ''}>
        {showClaude && (
          <AgentHistoryStrip
            data={claudeHistory.data}
            loading={claudeHistory.loading}
            error={claudeHistory.error}
            title={historyTitle('claude')}
            help={historyHelp('claude', AGENT_HISTORY_DAYS)}
            days={AGENT_HISTORY_DAYS}
            stacked={sideBySide}
          />
        )}
        {showCodex && (
          <AgentHistoryStrip
            data={codexHistory.data}
            loading={codexHistory.loading}
            error={codexHistory.error}
            title={historyTitle('codex')}
            help={historyHelp('codex', AGENT_HISTORY_DAYS)}
            days={AGENT_HISTORY_DAYS}
            stacked={sideBySide}
          />
        )}
      </div>
      {showClaude && (
        <AgentActivity
          data={claude}
          loading={liveSubagents.loading}
          title={`${AGENT_TITLE}${scope('claude')}`}
          help={CLAUDE_AGENTS_HELP}
          labels={CLAUDE_AGENT_LABELS}
        />
      )}
      {showCodex && (
        <AgentActivity
          data={codex}
          loading={codexAgents.loading}
          title={`${AGENT_TITLE}${scope('codex')}`}
          help={CODEX_AGENTS_HELP}
          labels={CODEX_AGENT_LABELS}
        />
      )}
    </>
  );
}
