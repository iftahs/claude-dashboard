import type { LiveExtraUsage, LiveSpend } from '@/types';

export interface ExtraUsageCardProps {
  extraUsage: LiveExtraUsage;
  spend?: LiveSpend | null;
  /** Whether the org has the extra-usage feature turned on at all (vs. this seat just being out of credits). */
  orgEnabled?: boolean;
}
