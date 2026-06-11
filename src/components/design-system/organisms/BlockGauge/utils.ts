export const BLOCK_MS = 5 * 3600_000;
export const DEFAULT_BLOCK_LIMIT = 6000000; // 6.0M effective tokens

export function formatRemaining(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  if (mins <= 0) return '0m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (remMins === 0) return `${hrs}h`;
  return `${hrs}h ${remMins}m`;
}
