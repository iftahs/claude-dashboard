import type { InsightsRetries } from '@/types';

export interface RetryPanelProps {
  data: InsightsRetries | null;
  /** Set when retries can't happen on this platform (Codex: a patch applies, fails or is declined, never retried) — renders n/a. */
  naText?: string;
  /** A scope note under the figures (e.g. "Claude edits only" under Both). */
  note?: string;
}
