/**
 * builder-cache.ts
 * Memoizes pure aggregate-builder outputs so the dashboard's frequent polls don't
 * re-run O(events) aggregation on every request. The raw event/insights scans are
 * already cached (cache.ts / insights-scan.ts); this caches the *derived* results.
 *
 * Correctness rests on two invariants:
 *  - the builders are pure functions of (events|insights, now, params);
 *  - the key bundles every param AND a validity token (eventsFingerprint() /
 *    insightsFingerprint(), i.e. data.ts::dataFingerprint).
 * Callers pin `now` to the scan's `computedAt`. The token covers the data and the
 * minute computedAt falls in, not computedAt itself, so a hit can be built from a
 * `now` up to a minute old: windows slide once a minute rather than once per 5s
 * rescan. (Keyed on the data alone, as it once was, an idle dashboard served
 * windows frozen at the last file write.) When the token flips (a file changed,
 * or a new minute began), the prior entry for that key is overwritten in place,
 * so the map stays bounded to builders × params × sources.
 */

interface Entry {
  token: number;
  value: unknown;
}

const store = new Map<string, Entry>();

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
  store.set(key, { token, value });
  return value;
}
