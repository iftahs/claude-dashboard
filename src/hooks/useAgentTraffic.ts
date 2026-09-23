import { useLiveData } from './useLiveData';
import { useSource } from './useSource';
import { isYourTurn } from '@/components/design-system/organisms/AgentActivity/utils';
import type { AgentTrafficStatus, LiveSubagents } from '../types';

export interface PlatformTraffic {
  running: number;
  waiting: number;
  finished: number;
  /** Main sessions idle on the user after a finished turn (soft; never lights the red lamp). */
  yourTurn: number;
}

export interface AgentTrafficCounts extends PlatformTraffic {
  /** Any agent currently running or waiting (vs. fully idle). */
  active: boolean;
  /** Dominant lamp: red (waiting) > yellow (running) > green (idle/finished). */
  signal: AgentTrafficStatus;
  /** The same tallies per platform — zero for a platform the switcher hides. */
  byPlatform: { claude: PlatformTraffic; codex: PlatformTraffic };
}

const NONE: PlatformTraffic = { running: 0, waiting: 0, finished: 0, yourTurn: 0 };

// running/waiting mirror the server's sidebar-badge counts; yourTurn is computed here, so an older server simply reports 0.
export function platformTraffic(d: LiveSubagents | null | undefined): PlatformTraffic {
  if (!d) return NONE;
  return {
    running: d.counts.running,
    waiting: d.counts.waiting,
    finished: d.counts.finished,
    yourTurn: d.mainAgents.filter(isYourTurn).length,
  };
}

/**
 * Traffic-light tallies + dominant state from the live agents polls, scoped to the
 * platform switcher: Claude Code only under 'claude', Codex (ChatGPT desktop) only
 * under 'codex', summed under 'both'. The Codex poll is disabled (empty data) unless Codex data exists locally
 * (platform pinned to Claude then), so Claude-only users see exactly the Claude counts.
 */
export function useAgentTraffic(): AgentTrafficCounts {
  const { showClaude, showCodex } = useSource();
  const { liveSubagents, codexAgents } = useLiveData();
  const claude = showClaude ? platformTraffic(liveSubagents.data) : NONE;
  const codex = showCodex ? platformTraffic(codexAgents.data) : NONE;
  const running = claude.running + codex.running;
  const waiting = claude.waiting + codex.waiting;
  const finished = claude.finished + codex.finished;
  const yourTurn = claude.yourTurn + codex.yourTurn;
  const signal: AgentTrafficStatus = waiting > 0 ? 'waiting' : running > 0 ? 'running' : 'finished';
  return {
    running,
    waiting,
    finished,
    yourTurn,
    active: running > 0 || waiting > 0,
    signal,
    byPlatform: { claude, codex },
  };
}
