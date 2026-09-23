import type { InsightsRejections } from '@/types';
import type { Platform } from '@/hooks/useSource';

export interface RejectionsPanelProps {
  data: InsightsRejections | null;
  /** Decides the wording: Claude permission prompts vs Codex guardian denials / declines. */
  platform: Platform;
}
