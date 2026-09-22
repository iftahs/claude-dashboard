import type { DailyActivity } from '@/types';

export interface CodexDailyCompareChartProps {
  /** Server-side per-day tokens from the Codex profile endpoint (UTC days, ascending). */
  server: { date: string; tokens: number }[];
  /** Local per-day Codex activity from /api/activity?source=codex (local-midnight days). */
  local: DailyActivity[];
  loading?: boolean;
  /** Window length in days; the chart always shows exactly this many, ending today. */
  days: number;
}

/** One chart row: both series for one calendar day. */
export interface CompareRow {
  date: string;
  label: string;
  server: number;
  local: number;
}

export interface CompareTooltipProps {
  active?: boolean;
  payload?: { payload: CompareRow }[];
}
