import type { LatencyStats } from '@/types';
import type { LatencyTile } from './types';

/** Same clay / teal platform pair as the Trends comparison and the complexity scatter. */
export const LATENCY_COLOR = { claude: '#d97757', codex: '#14b8a6' } as const;

/** 850 ms → "0.9s", 42 s → "42s", 4 min 5 s → "4m 05s", 83 min → "1h 23m"; null → "—". */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—';
  const s = ms / 1000;
  if (s < 10) return `${s.toFixed(1)}s`;
  if (s < 60) return `${Math.round(s)}s`;
  const totalSec = Math.round(s);
  const m = Math.floor(totalSec / 60);
  if (m < 60) return `${m}m ${String(totalSec % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** Total active time, coarse: "3.2h", "45m". */
export function formatActive(ms: number): string {
  const h = ms / 3_600_000;
  return h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(ms / 60_000)}m`;
}

export function latencyTiles(s: LatencyStats): LatencyTile[] {
  return [
    { label: 'Median turn', value: formatDuration(s.medianMs), help: 'Half of all turns finished faster than this.' },
    { label: 'p90 turn', value: formatDuration(s.p90Ms), help: '90% of turns finished faster than this — the long tail.' },
    { label: 'Median first token', value: formatDuration(s.medianTtftMs), help: 'Time from your prompt to the first reply.' },
    { label: 'p90 first token', value: formatDuration(s.p90TtftMs), help: 'The slow end of time-to-first-token.' },
  ];
}
