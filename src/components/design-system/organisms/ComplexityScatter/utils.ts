import type { Platform } from '@/hooks/useSource';
import type { InsightPlatform } from '@/types';

/**
 * Platform colours — the same clay / teal pair the Trends platform comparison uses,
 * so Claude and Codex read the same in every Both chart. A single-platform view keeps
 * the clay fill it always had.
 */
export const PLATFORM_DOT_COLOR: Record<InsightPlatform, string> = { claude: '#d97757', codex: '#14b8a6' };
export const PLATFORM_NAME: Record<InsightPlatform, string> = { claude: 'Claude', codex: 'Codex' };

/** What the dot size counts on each platform: Claude subagents, Codex guardian reviews (one per verdict). */
export function sizeLabel(platform: Platform): string {
  if (platform === 'codex') return 'Guardian reviews';
  if (platform === 'both') return 'Subagents / reviews';
  return 'Subagents';
}

/** Largest dot area — a thread with 100+ guardian reviews must not swallow the chart. */
export const MAX_DOT_AREA = 600;
