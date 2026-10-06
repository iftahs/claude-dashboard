export interface SwrOptions<T> {
  ttlMs: number;
  maxStaleMs: number;
  build: () => Promise<T>;
  now?: () => number;
  onError?: (e: unknown) => void;
}

// Fresh under ttlMs; up to maxStaleMs the previous value is served while one rebuild runs; otherwise callers wait for it.
export function swrCache<T>({ ttlMs, maxStaleMs, build, now = Date.now, onError }: SwrOptions<T>): () => Promise<T> {
  let entry: { value: T; at: number } | null = null;
  let inflight: Promise<T> | null = null;

  function refresh(): Promise<T> {
    if (inflight) return inflight;
    const p = new Promise<T>((resolve) => resolve(build()))
      .then((value) => {
        entry = { value, at: now() };
        return value;
      })
      .finally(() => {
        inflight = null;
      });
    // Handled here as well: a caller served the stale value never awaits the rebuild.
    p.catch((e) => onError?.(e));
    inflight = p;
    return p;
  }

  return async () => {
    const hit = entry;
    const age = hit ? now() - hit.at : Infinity;
    if (hit && age < ttlMs) return hit.value;
    const pending = refresh();
    return hit && age < maxStaleMs ? hit.value : pending;
  };
}
