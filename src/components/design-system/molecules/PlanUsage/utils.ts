export function formatRemainingHours(ms: number): string {
  const hours = Math.ceil(ms / 3600_000);
  if (hours <= 0) return '0h';
  return `${hours}h`;
}

export function formatRemainingDays(ms: number): string {
  const days = Math.ceil(ms / (24 * 3600_000));
  if (days <= 0) return '0d';
  return `${days}d`;
}

export function blockBarColor(pct: number): string {
  if (pct >= 90) return '#ef4444';
  if (pct >= 70) return '#f59e0b';
  return '#d97757';
}
