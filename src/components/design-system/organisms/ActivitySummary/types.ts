import type { ReactNode } from 'react';
import type { Platform } from '@/hooks/useSource';
import type { UsageSummaryData } from '@/types';

export interface ActivitySummaryProps {
  /** GET /api/usage/summary for the platform on screen (unscoped under Both, with `byPlatform`). */
  summary: UsageSummaryData | null;
  loading: boolean;
  platform: Platform;
  /**
   * OpenAI's own lifetime token count for the account (every device, all tokens)
   * from /api/codex/profile — shown beside the local figure under Codex and Both.
   * null/undefined when the profile is unavailable.
   */
  codexServerLifetime?: number | null;
  /** Platform suffix for the heading (`titleScope(platform)`); '' under Claude. */
  scope?: string;
}

/** One summary card, already formatted. */
export interface SummaryCard {
  key: 'lifetime' | 'peak' | 'streak' | 'active';
  label: string;
  value: string;
  sub: string;
  /** Second sub-line: the server-side figure (Codex) or the Claude/Codex split (Both). */
  extra: string | null;
  help: ReactNode;
}
