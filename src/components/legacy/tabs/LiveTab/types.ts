import type { ReactNode } from 'react';
import type { Limits } from '@/hooks/useLimits';
import type { PollState } from '@/hooks/usePolling';
import type { CodexBlock } from '@/types';

export interface LiveTabProps {
  limits: Limits;
}

/** What a platform's gauge needs beyond the shared live polls. */
export interface GaugeCostProps {
  /** Estimated $/day for this platform (fills the API-mode ring against the daily cap). */
  costPerDay: number;
  dailyLimit: number | null;
}

export interface ClaudeGaugeProps extends GaugeCostProps {
  /** Real billed spend today from a LiteLLM gateway (Claude only). */
  todayActualCost: number | null;
}

export interface CodexGaugeProps extends GaugeCostProps {
  block: PollState<CodexBlock>;
}

export interface SideBySideProps {
  /** One node per platform; null/false entries are dropped and the rest share the row. */
  items: ReactNode[];
}
