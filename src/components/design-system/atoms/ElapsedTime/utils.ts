import type { ElapsedTimeFormat } from './types';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const MIN_INTERVAL_MS = 250;

function wholeSeconds(ms: number): number {
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
}

export function formatElapsed(ms: number): string {
  const total = wholeSeconds(ms);
  if (total < SECONDS_PER_MINUTE) return `${total}s`;
  const minutes = Math.floor(total / SECONDS_PER_MINUTE);
  if (total < SECONDS_PER_HOUR) return `${minutes}m ${total % SECONDS_PER_MINUTE}s`;
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  if (total < SECONDS_PER_DAY) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(total / SECONDS_PER_DAY)}d ${hours % 24}h`;
}

export function formatAgo(ms: number): string {
  const total = wholeSeconds(ms);
  if (total < SECONDS_PER_MINUTE) return `${total}s ago`;
  if (total < SECONDS_PER_HOUR) return `${Math.floor(total / SECONDS_PER_MINUTE)}m ago`;
  if (total < SECONDS_PER_DAY) return `${Math.floor(total / SECONDS_PER_HOUR)}h ago`;
  return `${Math.floor(total / SECONDS_PER_DAY)}d ago`;
}

export function formatSince(ms: number, format: ElapsedTimeFormat): string {
  return format === 'ago' ? formatAgo(ms) : formatElapsed(ms);
}

export function tickInterval(intervalMs: number): number {
  return Number.isFinite(intervalMs) ? Math.max(MIN_INTERVAL_MS, intervalMs) : 1000;
}
