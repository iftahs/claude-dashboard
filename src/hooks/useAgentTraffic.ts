import { useLiveData } from './useLiveData';

export interface AgentTrafficCounts {
  running: number;
  waiting: number;
  finished: number;
}

/** Traffic-light tallies from the live agents poll (server-computed counts). */
export function useAgentTraffic(): AgentTrafficCounts {
  const { liveSubagents } = useLiveData();
  const c = liveSubagents.data?.counts;
  return {
    running: c?.running ?? 0,
    waiting: c?.waiting ?? 0,
    finished: c?.finished ?? 0,
  };
}
