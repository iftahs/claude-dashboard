import type { InsightsRetries } from '@/types';

export interface RetryPanelProps {
  data: InsightsRetries | null;
  /**
   * Set when retries cannot happen on the platform shown (Codex: a patch applies,
   * fails or is declined — never retried). Renders an n/a state with this reason.
   */
  naText?: string;
  /** A scope note under the figures (e.g. "Claude edits only" under Both). */
  note?: string;
}
