import type { UsageSource } from '@/types';

export type Platform = 'claude' | 'codex' | 'both';
export type SourceFilter = 'all' | UsageSource;

// Neutral (shows Claude, Codex or both) — keep in sync with useDocumentTitle and index.html's first-paint title.
export const BRAND = 'AI Usage';

/**
 * Series colours. Claude takes the dashboard's clay accent (the same hue the
 * Sources split gives Claude Code); Codex takes the teal that split already uses
 * for the Codex surface, so a reader who has seen one chart recognises the other.
 * These are platform colours, deliberately NOT the per-model palette — this chart
 * compares two vendors, not two models.
 */
export const CLAUDE_COLOR = '#d97757';
export const CODEX_COLOR = '#14b8a6';

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

export type SurfaceKey = UsageSource | 'chat' | 'other';

// One colour per surface on every chart that splits by surface (Live's weekly breakdown, Trends' sources split).
export const SURFACE_COLOR: Record<SurfaceKey, string> = {
  code: 'rgb(var(--platform-claude))',
  cowork: 'rgb(var(--tag-2))',
  chat: 'rgb(var(--tag-6))',
  codex: 'rgb(var(--platform-codex))',
  other: 'rgb(var(--tag-untagged))',
};

export const SURFACE_LABEL: Record<SurfaceKey, string> = {
  code: 'Claude Code',
  cowork: 'Cowork',
  chat: 'Chats',
  codex: 'Codex',
  other: 'Other',
};
