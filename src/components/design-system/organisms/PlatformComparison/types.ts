import type { ReactNode } from 'react';
import type { PollState } from '@/hooks/usePolling';
import type { CodexLiveData, CodexProfileStats, ModelShare, SourceSplit } from '@/types';
import type { WeekStart } from '@/lib/week';

/** One row of the per-platform metric card. */
export interface ComparisonRow {
  key: string;
  label: string;
  value: string;
  help?: string;
}

export interface PlatformComparisonProps {
  /** The Claude rate-limit card, rendered by the caller (PlanUsage or AccountsLivePanel). */
  claudePlan: ReactNode;
  codexLive: PollState<CodexLiveData>;
  codexProfile: PollState<CodexProfileStats>;
  weekStart: WeekStart;
  /** Per-surface totals for the selected Trends window. Null on a backend that predates it. */
  bySource: SourceSplit | null;
  /** Per-model shares for the same window — split into families for the "top model" row. */
  byModel: ModelShare[];
  weekDays: number;
  loading?: boolean;
}
