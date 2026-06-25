import type { ActiveBlock, LiveUsageData } from '@/types';

export interface BlockGaugeProps {
  block: ActiveBlock | null;
  liveUsage?: LiveUsageData | null;
  /** API / pay-as-you-go mode — render an estimated-cost view instead of plan %. */
  isApi?: boolean;
  /** Estimated average $/day (used to fill the ring against a daily cap, if set). */
  costPerDay?: number;
  /** Daily USD cap from Settings, if configured. */
  dailyLimit?: number | null;
  /** Real billed cost so far today (from a LiteLLM gateway). When set, the daily-cap
   *  ring uses this instead of the estimated costPerDay. */
  todayActualCost?: number | null;
}
