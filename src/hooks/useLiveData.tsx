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
  CodexLiveData,
  CodexProfileStats,
} from '../types';

const POLL = 5000;

/** Poll interval for a `days`-long weekly aggregate (Trends window). */
export function weeklyPollMs(days: number): number {
  return days > 28 ? 60_000 : POLL;
}

interface LiveDataCtx {
  // Window state shared across Live + Trends (Live's cost/day uses the Trends window).
  recentHours: number;
  setRecentHours: (h: number) => void;
  weekDays: number;
  setWeekDays: (d: number) => void;
  // Cross-tab polls (feed multiple tabs and/or the header/sidebar).
  recent: PollState<RecentData>;
  weekly: PollState<WeeklyData>;
  /** Always the last 7 days at the fast rate — Live, budget rows, alerts. */
  liveWeekly: PollState<WeeklyData>;
  models: PollState<ModelsData>;
  litellm: PollState<LiteLlmSpendData>;
  liveUsage: PollState<LiveUsageData>;
  liveSubagents: PollState<LiveSubagents>;
  workflows: PollState<WorkflowsData>;
  workflowStats: PollState<WorkflowStats>;
  version: PollState<VersionInfo>;
  // Codex (ChatGPT desktop) — all three are disabled (empty URL, no request) unless
  // /api/sources reports Codex data, so Claude-only users poll nothing new.
  codexLive: PollState<CodexLiveData>;
  codexAgents: PollState<LiveSubagents>;
  codexProfile: PollState<CodexProfileStats>;
}

const LiveDataContext = createContext<LiveDataCtx | null>(null);

/**
 * The polls that more than one tab (or the header/sidebar) depend on, plus the
 * window state shared between Live and Trends. Source-aware polls run through
 * `withSrc`; the LiteLLM poll is gated on gateway detection so Code-only /
 * direct-Anthropic users poll nothing; the Codex polls are gated the same way on
 * `codexAvailable` (they feed the Codex tab, the sidebar badge and the header
 * agent traffic signal).
 */
export function LiveDataProvider({ children }: { children: ReactNode }) {
  const { withSrc, codexAvailable } = useSource();
  const { litellmAvailable } = useConfigMode();
  const [recentHours, setRecentHours] = useState(12);
  const [weekDays, setWeekDays] = useState(7);

  const recent = usePolling<RecentData>(withSrc(`/api/usage/recent?hours=${recentHours}`), POLL);
  // Long windows move slowly and their payload is large (up to 365 buckets), so
  // they poll once a minute instead of every 5 s.
  const weekly = usePolling<WeeklyData>(withSrc(`/api/usage/weekly?days=${weekDays}`), weeklyPollMs(weekDays));
  // Live, budget rows and alerts always need the last 7 days at the fast rate,
  // whatever the Trends window is. With weekDays = 7 the URLs match and the
  // in-flight map collapses the two polls into one request.
  const liveWeekly = usePolling<WeeklyData>(withSrc('/api/usage/weekly?days=7'), POLL);
  const models = usePolling<ModelsData>(withSrc('/api/usage/models?days=7'), POLL);
  const litellm = usePolling<LiteLlmSpendData>(
    litellmAvailable ? `/api/usage/litellm?days=${weekDays}` : '',
    // The server caches gateway spend for 5 minutes; polling faster only re-slices it.
    60_000,
  );
  const liveUsage = usePolling<LiveUsageData>('/api/usage/live', 15000);
  const liveSubagents = usePolling<LiveSubagents>('/api/subagents/live', 2500);
  const workflows = usePolling<WorkflowsData>('/api/workflows', 4000);
  const workflowStats = usePolling<WorkflowStats>('/api/workflows/stats', 30000);
  const version = usePolling<VersionInfo>('/api/version', 1_800_000);
  // Codex: live limits mirror the Claude live cadence, agents the Claude agents
  // cadence; the profile endpoint is server-cached for 30 min so poll it that often.
  const codexLive = usePolling<CodexLiveData>(codexAvailable ? '/api/codex/live' : '', 15000);
  const codexAgents = usePolling<LiveSubagents>(codexAvailable ? '/api/codex/agents/live' : '', 2500);
  const codexProfile = usePolling<CodexProfileStats>(codexAvailable ? '/api/codex/profile' : '', 1_800_000);

  const value = useMemo<LiveDataCtx>(
    () => ({
      recentHours,
      setRecentHours,
      weekDays,
      setWeekDays,
      recent,
      weekly,
      liveWeekly,
      models,
      litellm,
      liveUsage,
      liveSubagents,
      workflows,
      workflowStats,
      version,
      codexLive,
      codexAgents,
      codexProfile,
    }),
    [
      recentHours, weekDays, recent, weekly, liveWeekly, models, litellm, liveUsage, liveSubagents,
      workflows, workflowStats, version, codexLive, codexAgents, codexProfile,
    ],
  );

  return <LiveDataContext.Provider value={value}>{children}</LiveDataContext.Provider>;
}

export function useLiveData(): LiveDataCtx {
  const ctx = useContext(LiveDataContext);
  if (!ctx) throw new Error('useLiveData must be used within a LiveDataProvider');
  return ctx;
}
