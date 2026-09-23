/** Which alert thresholds already fired, persisted so a reload or another tab doesn't alert again in the same window. */
export function readAlertMemory<T>(key: string, isEntry: (v: unknown) => v is T): Record<string, T> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    if (!raw || typeof raw !== 'object') return {};
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => isEntry(v))) as Record<string, T>;
  } catch {
    return {};
  }
}

export function writeAlertMemory(key: string, state: Record<string, unknown>): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* private mode / quota — the in-memory copy still dedupes this tab */
  }
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
