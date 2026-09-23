import type { Platform } from '@/hooks/useSource';
import type { InsightPlatform } from '@/types';

// Same clay/teal pair as the Trends platform comparison, so Claude and Codex read the same in every Both chart.
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
