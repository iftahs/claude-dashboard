import type { WeeklyData } from '@/types';
import type { DailyMetric } from '@/components/design-system/organisms/DailyTrendChart/types';

export interface PlatformDailyCompareChartProps {
  /** `/api/usage/weekly?source=claude` — Claude Code + Cowork. */
  claude: WeeklyData | null;
  /** `/api/usage/weekly?source=codex` — the ChatGPT desktop agent. */
  codex: WeeklyData | null;
  loading: boolean;
  /** Window length in days; also the label in the section title. */
  weekDays: number;
  /** Shared with the daily-trend chart below, so the page reads in one unit. */
  metric: DailyMetric;
  onMetricChange: (m: DailyMetric) => void;
}

/** One chart row: both platforms' figure for the same day bucket. */
export interface CompareRow {
  start: number;
  label: string;
  claude: number;
  codex: number;
}

export interface CompareTooltipProps {
  active?: boolean;
  payload?: { payload: CompareRow }[];
  metric?: DailyMetric;
}
