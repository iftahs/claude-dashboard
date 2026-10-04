import type { SessionMeta, SessionTranscript } from '@/types';

export type SessionNoun = 'sessions' | 'threads';

export interface TranscriptState {
  data: SessionTranscript | null;
  loading: boolean;
  error: string | null;
}

/** 'session' / 'thread' ('Session' / 'Thread' when `capital`). */
export function singularNoun(noun: SessionNoun, capital = false): string {
  const one = noun === 'threads' ? 'thread' : 'session';
  return capital ? one[0].toUpperCase() + one.slice(1) : one;
}

/** "Sep 3" — the start of the span a "since …" label covers. */
export function sinceLabel(since: number | null): string {
  if (since === null) return '';
  return new Date(since).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "<1m" / "45m" / "3h 12m" / "4d 6h" for a duration in milliseconds. */
export function formatDurationMs(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60_000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** "4s" / "1m 23s" for a short span (a single turn). */
export function formatTurnMs(ms: number): string {
  const s = Math.round(Math.max(0, ms) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function sessionTokens(s: SessionMeta): number {
  return s.effective_tokens ?? (s.input_tokens ?? 0) + (s.output_tokens ?? 0);
}

/** "owner/repo#12" for a GitHub-style PR URL; the URL itself otherwise. */
export function prLabel(url: string): string {
  const m = url.match(/^https?:\/\/[^/]+\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  return m ? `${m[1]}#${m[2]}` : url;
}
