import type { ActiveBlock, LiveUsageData } from '@/types';

export interface BlockGaugeProps {
  block: ActiveBlock | null;
  liveUsage?: LiveUsageData | null;
}
