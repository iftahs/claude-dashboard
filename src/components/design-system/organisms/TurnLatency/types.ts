import type { InsightsTurns } from '@/types';
import type { Platform } from '@/hooks/useSource';

export interface TurnLatencyProps {
  data: InsightsTurns | null;
  /** Under Both the histogram stacks Claude and Codex and the stats split per platform. */
  platform: Platform;
}

export interface HistogramRow {
  label: string;
  claude: number;
  codex: number;
  total: number;
}

export interface HistogramTooltipProps {
  active?: boolean;
  payload?: { payload: HistogramRow }[];
  split: boolean;
}

export interface LatencyTile {
  label: string;
  value: string;
  help: string;
}
