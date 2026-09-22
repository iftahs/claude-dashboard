import type { Platform } from '@/hooks/useSource';

/**
 * How the header platform switcher's value reads in body copy — section titles,
 * help text, stat-card sub-labels. Distinct from `PLATFORM_LABELS` in
 * `useSource`, which labels the switcher's own buttons ("Both" is a fine button
 * but a poor noun in a sentence).
 */
export const PLATFORM_NOUN: Record<Platform, string> = {
  claude: 'Claude',
  codex: 'Codex',
  both: 'Claude + Codex',
};

/**
 * Suffix that names the platform in a section title. Empty under Claude on
 * purpose: with no Codex data the switcher never appears, and every title stays
 * exactly what it was before Codex support existed.
 */
export function titleScope(platform: Platform): string {
  return platform === 'claude' ? '' : ` · ${PLATFORM_NOUN[platform]}`;
}
