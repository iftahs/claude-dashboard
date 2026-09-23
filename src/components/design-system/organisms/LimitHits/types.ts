import type { LimitHitEpisode } from '@/types';

export interface LimitHitsProps {
  /** Most recent episodes listed (default 6). */
  maxRows?: number;
}

export interface LimitHitRowProps {
  episode: LimitHitEpisode;
  /** Tag the row with its platform (Both mode lists Claude and Codex together). */
  showPlatform: boolean;
  now: number;
}

export interface LimitFigureProps {
  label: string;
  value: string;
  sub: string;
  /** Value colour override (red while blocked). */
  accent?: string;
}
