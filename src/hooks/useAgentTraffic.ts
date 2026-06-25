import { useLiveData } from './useLiveData';
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

/** Traffic-light tallies + dominant state from the live agents poll. */
export function useAgentTraffic(): AgentTrafficCounts {
  const { liveSubagents } = useLiveData();
  const c = liveSubagents.data?.counts;
  const running = c?.running ?? 0;
  const waiting = c?.waiting ?? 0;
  const finished = c?.finished ?? 0;
  const signal: AgentTrafficStatus = waiting > 0 ? 'waiting' : running > 0 ? 'running' : 'finished';
  return { running, waiting, finished, active: running > 0 || waiting > 0, signal };
}
