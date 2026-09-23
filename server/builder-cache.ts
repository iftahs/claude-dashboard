/**
 * builder-cache.ts
 * Memoizes pure aggregate-builder outputs so the dashboard's frequent polls don't
 * re-run O(events) aggregation on every request. The raw event/insights scans are
 * already cached (cache.ts / insights-scan.ts); this caches the *derived* results.
 *
 * Correctness rests on two invariants:
 *  - the builders are pure functions of (events|insights, now, params);
 *  - the key bundles every param AND a validity token (data fingerprint + the current minute, so windows still slide while idle).
 * Keys are builders × params × sources — bounded by intParam()'s clamps, but a full range sweep can still reach thousands, so the map also evicts LRU past MEMO_MAX.
 */

interface Entry {
  token: number;
  value: unknown;
}

/** Far above what the UI polls at once (a few dozen keys), far below a key sweep. */
export const MEMO_MAX = 256;

const store = new Map<string, Entry>();

export function memoSize(): number {
  return store.size;
}

/**
 * Return the cached builder output for (name, keyParts) when it was computed
 * under the same validity `token`; otherwise run `compute`, cache, and return it.
 */
export function memoBuilder<T>(
  name: string,
  keyParts: Array<string | number>,
  token: number,
  compute: () => T,
): T {
  const key = `${name}|${keyParts.join('|')}`;
  const hit = store.get(key);
  if (hit && hit.token === token) return hit.value as T;
  const value = compute();
  store.delete(key); // re-insert at the back: recently rebuilt = recently used
  if (store.size >= MEMO_MAX) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { token, value });
  return value;
}
