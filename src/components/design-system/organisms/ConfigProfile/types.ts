import type { ClaudeConfig } from '@/types';

export interface ConfigProfileProps {
  config: ClaudeConfig | null;
  /** API / pay-as-you-go mode — show billing instead of subscription/rate tier. */
  isApi?: boolean;
}
