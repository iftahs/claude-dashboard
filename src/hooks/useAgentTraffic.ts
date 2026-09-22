import { useLiveData } from './useLiveData';
import { useSource } from './useSource';
import type { AgentTrafficStatus } from '../types';

export interface AgentTrafficCounts {
  running: number;
  waiting: number;
  finished: number;
  /** Any agent currently running or waiting (vs. fully idle). */
  active: boolean;
  /** Dominant lamp: red (waiting) > yellow (running) > green (idle/finished). */
  signal: AgentTrafficStatus;
}

/**
 * Traffic-light tallies + dominant state from the live agents polls, scoped to the
 * platform switcher: Claude Code only under 'claude', Codex (ChatGPT desktop) only
 * under 'codex', summed under 'both'. The header lamp, the Agents badge and the
 * attention chime all key off these counts. The Codex poll is disabled (empty data)
 * unless Codex data exists locally — and the platform is pinned to Claude then — so
 * Claude-only users see exactly the Claude counts.
 */
export function useAgentTraffic(): AgentTrafficCounts {
  const { showClaude, showCodex } = useSource();
  const { liveSubagents, codexAgents } = useLiveData();
  const c = showClaude ? liveSubagents.data?.counts : undefined;
  const x = showCodex ? codexAgents.data?.counts : undefined;
  const running = (c?.running ?? 0) + (x?.running ?? 0);
  const waiting = (c?.waiting ?? 0) + (x?.waiting ?? 0);
  const finished = (c?.finished ?? 0) + (x?.finished ?? 0);
  const signal: AgentTrafficStatus = waiting > 0 ? 'waiting' : running > 0 ? 'running' : 'finished';
  return { running, waiting, finished, active: running > 0 || waiting > 0, signal };
}
