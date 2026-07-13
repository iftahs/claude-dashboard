/** "2h 14m" / "3m 20s" / "now" countdown for a millisecond delta. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** Last path segment of a project path (handles both slashes); '' stays ''. */
export function projectBasename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** Short display form of a session id (uuid → first 8 chars). */
export function shortSessionId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}
