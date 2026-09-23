import type { InsightsYield } from '@/types';

export interface YieldPanelProps {
  data: InsightsYield | null;
}

/** One funnel row: a count of sessions, drawn against the first stage. */
export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  /** Tailwind background class of the stage's bar. */
  barClass: string;
  hint: string;
}
