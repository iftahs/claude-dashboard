import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePolling } from './usePolling';
import type { PollState } from './usePolling';
import { useSource } from './useSource';
import { useConfigMode } from './useConfigMode';
import type {
  RecentData,
  WeeklyData,
  ModelsData,
  LiteLlmSpendData,
  LiveUsageData,
  LiveSubagents,
  WorkflowsData,
  WorkflowStats,
  VersionInfo,
} from '../types';

const POLL = 5000;

interface LiveDataCtx {
  // Window state shared across Live + Trends (Live's cost/day uses the Trends window).
  recentHours: number;
  setRecentHours: (h: number) => void;
  weekDays: number;
  setWeekDays: (d: number) => void;
  // Cross-tab polls (feed multiple tabs and/or the header/sidebar).
  recent: PollState<RecentData>;
  weekly: PollState<WeeklyData>;
  models: PollState<ModelsData>;
  litellm: PollState<LiteLlmSpendData>;
  liveUsage: PollState<LiveUsageData>;
  liveSubagents: PollState<LiveSubagents>;
  workflows: PollState<WorkflowsData>;
  workflowStats: PollState<WorkflowStats>;
  version: PollState<VersionInfo>;
}

const LiveDataContext = createContext<LiveDataCtx | null>(null);

/**
 * The polls that more than one tab (or the header/sidebar) depend on, plus the
 * window state shared between Live and Trends. Source-aware polls run through
 * `withSrc`; the LiteLLM poll is gated on gateway detection so Code-only /
 * direct-Anthropic users poll nothing.
 */
export function LiveDataProvider({ children }: { children: ReactNode }) {
  const { withSrc } = useSource();
  const { litellmAvailable } = useConfigMode();
  const [recentHours, setRecentHours] = useState(12);
  const [weekDays, setWeekDays] = useState(7);

  const recent = usePolling<RecentData>(withSrc(`/api/usage/recent?hours=${recentHours}`), POLL);
  const weekly = usePolling<WeeklyData>(withSrc(`/api/usage/weekly?days=${weekDays}`), POLL);
  const models = usePolling<ModelsData>(withSrc('/api/usage/models?days=7'), POLL);
  const litellm = usePolling<LiteLlmSpendData>(
    litellmAvailable ? `/api/usage/litellm?days=${weekDays}` : '',
    POLL,
  );
  const liveUsage = usePolling<LiveUsageData>('/api/usage/live', 15000);
  const liveSubagents = usePolling<LiveSubagents>('/api/subagents/live', 2500);
  const workflows = usePolling<WorkflowsData>('/api/workflows', 4000);
  const workflowStats = usePolling<WorkflowStats>('/api/workflows/stats', 30000);
  const version = usePolling<VersionInfo>('/api/version', 1_800_000);

  const value = useMemo<LiveDataCtx>(
    () => ({
      recentHours,
      setRecentHours,
      weekDays,
      setWeekDays,
      recent,
      weekly,
      models,
      litellm,
      liveUsage,
      liveSubagents,
      workflows,
      workflowStats,
      version,
    }),
    [recentHours, weekDays, recent, weekly, models, litellm, liveUsage, liveSubagents, workflows, workflowStats, version],
  );

  return <LiveDataContext.Provider value={value}>{children}</LiveDataContext.Provider>;
}

export function useLiveData(): LiveDataCtx {
  const ctx = useContext(LiveDataContext);
  if (!ctx) throw new Error('useLiveData must be used within a LiveDataProvider');
  return ctx;
}
