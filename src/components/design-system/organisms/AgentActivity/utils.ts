/** Elapsed seconds since a unix-ms timestamp */
export function elapsedSec(startedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

/** Format elapsed seconds as "1m 23s" or "45s" */
export function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

/** Strip claude- prefix and date suffix for display */
export function displayModel(model: string): string {
  if (!model || model === 'inherit') return 'inherit';
  return model
    .replace(/^claude-/, '')
    .replace(/-\d{8}$/, '')
    .replace(/-(\d)-(\d)$/, ' $1.$2');
}
