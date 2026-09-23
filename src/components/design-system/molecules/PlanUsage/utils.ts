import { limitColor } from '@/lib/limits';
import type { LiveWeeklyBreakdown } from '@/types';

/** Fill for a rate-limit bar — the shared 70 / 90 % tones (see lib/limits). */
export function blockBarColor(pct: number): string {
  return limitColor(pct);
}

const MODEL_COLORS: Record<string, string> = {
  Opus: '#a78bfa',
  Sonnet: '#10b981',
  Haiku: '#f472b6',
  Fable: '#f59e0b',
};
export const DEFAULT_MODEL_COLOR = '#22d3ee';

/** Legacy `seven_day_<model>` keys → bar colour. */
export const LEGACY_MODEL_COLORS = { sonnet: MODEL_COLORS.Sonnet, opus: MODEL_COLORS.Opus, cowork: DEFAULT_MODEL_COLOR };

// Anthropic's display_name is a plain family word today ("Opus"), but a generation
// may get appended ("Opus 5") — match the family out of it rather than keying on the
// whole string, which would silently drop every bar to DEFAULT_MODEL_COLOR.
export function modelBarColor(displayName: string): string {
  const family = displayName.match(/fable|mythos|opus|sonnet|haiku/i)?.[0].toLowerCase();
  const key = family && family[0].toUpperCase() + family.slice(1);
  return (key && MODEL_COLORS[key]) || DEFAULT_MODEL_COLOR;
}

/** Surface colours for the weekly split — Code and Cowork match the Sources chart. */
const SURFACE_COLORS: Record<string, string> = {
  claude_code: '#d97757',
  cowork: '#6366f1',
  chat: '#a78bfa',
};
const SURFACE_LABELS: Record<string, string> = {
  claude_code: 'Claude Code',
  cowork: 'Cowork',
  chat: 'Chats',
  other: 'Other',
};
const OTHER_SURFACE_COLOR = '#52525b';

export interface SurfaceSegment {
  key: string;
  label: string;
  pct: number;
  color: string;
}

/**
 * The weekly breakdown's rows as bar segments, empty rows dropped. The rows are each
 * surface's share of this week's usage so far (they sum to 100), not of the quota.
 */
export function surfaceSegments(b: LiveWeeklyBreakdown | null | undefined): SurfaceSegment[] {
  if (!b || !Array.isArray(b.rows)) return [];
  const rows = b.rows.filter((r) => typeof r.percent === 'number' && r.percent > 0);
  const total = rows.reduce((s, r) => s + r.percent, 0);
  if (total <= 0) return [];
  return rows.map((r) => ({
    key: r.key,
    label: r.display_name || SURFACE_LABELS[r.key] || r.key.replace(/_/g, ' '),
    pct: (r.percent / total) * 100,
    color: SURFACE_COLORS[r.key] ?? OTHER_SURFACE_COLOR,
  }));
}

/** Text colour of a gate row's status. */
export const GATE_TONE_CLASS = {
  ok: 'text-emerald-400',
  muted: 'text-zinc-500',
  danger: 'text-red-400',
} as const;
