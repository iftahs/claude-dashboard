import type { ReactNode } from 'react';
import type { Platform } from '@/hooks/useSource';
import type { UsageSummaryData } from '@/types';

export interface ActivitySummaryProps {
  /** GET /api/usage/summary for the platform on screen (unscoped under Both, with `byPlatform`). */
  summary: UsageSummaryData | null;
  loading: boolean;
  platform: Platform;
  /** OpenAI's lifetime token count from /api/codex/profile; null/undefined when the profile is unavailable. */
  codexServerLifetime?: number | null;
  /** Platform suffix for the heading (`titleScope(platform)`); '' under Claude. */
  scope?: string;
}

export interface SummaryCard {
  key: 'lifetime' | 'peak' | 'streak' | 'active';
  label: string;
  value: string;
  sub: string;
  /** Extra sub-lines: the Claude/Codex split (Both), then OpenAI's server-side figure (Codex, Both). */
  extra: string[];
  help: ReactNode;
}
