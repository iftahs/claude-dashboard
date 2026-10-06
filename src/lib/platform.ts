import type { UsageSource } from '@/types';

export type Platform = 'claude' | 'codex' | 'both';
export type SourceFilter = 'all' | UsageSource;

// Neutral (shows Claude, Codex or both) — keep in sync with useDocumentTitle and index.html's first-paint title.
export const BRAND = 'AI Usage';

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
