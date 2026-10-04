import { shortModel, untilFull } from '@/lib/format';
import type { LimitHitEpisode } from '@/types';

export const LIMIT_HITS_HELP =
  'Requests the provider refused because a usage limit was reached, read from local logs. One hit is one episode: every refused retry until that limit reset counts once (the refused requests are in brackets). Usage from other devices is not in the local logs, so a hit there does not show.';

/** What limit an episode hit, in the platform's own words. */
export function kindLabel(e: LimitHitEpisode): string {
  switch (e.kind) {
    case 'session':
      return '5-hour limit';
    case 'weekly':
      return 'Weekly limit';
    case 'model': {
      if (e.source === 'codex') return 'Premium model limit';
      const name = shortModel(e.model);
      return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)} limit` : 'Model limit';
    }
    default:
      return 'Usage limit';
  }
}

/** "2d 3h" / "1h 20m" / "45m" for a duration. */
function duration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

/** "lifts in 1h 20m" while blocked, "blocked 3h 5m" once lifted, "reset not recorded" without a time. */
export function resetLabel(e: LimitHitEpisode, now: number): { text: string; active: boolean } {
  if (e.resetsAt === null) return { text: 'reset not recorded', active: false };
  if (e.resetsAt > now) return { text: `lifts in ${untilFull(e.resetsAt)}`, active: true };
  return { text: `blocked ${duration(e.resetsAt - e.start)}`, active: false };
}

export const PLATFORM_OF: Record<LimitHitEpisode['source'], 'Claude' | 'Codex'> = {
  code: 'Claude',
  cowork: 'Claude',
  codex: 'Codex',
};

/** Row tag colours under Both — the Code and Codex hues of the Sources chart. */
export const PLATFORM_COLOR: Record<'Claude' | 'Codex', string> = { Claude: '#d97757', Codex: '#14b8a6' };
