import { scanEvents, projectsFingerprint, type UsageEvent } from './scan.ts';

const TTL_MS = 5000;

let cached: UsageEvent[] = [];
let cachedAt = 0;
let cachedFingerprint = -1;
let inflight: Promise<UsageEvent[]> | null = null;

/** Return parsed+deduped events, re-scanning only when TTL elapsed or files changed. */
export async function getEvents(): Promise<{ events: UsageEvent[]; computedAt: number }> {
  const now = Date.now();
  if (now - cachedAt < TTL_MS && cachedAt !== 0) {
    return { events: cached, computedAt: cachedAt };
  }
  if (inflight) {
    await inflight;
    return { events: cached, computedAt: cachedAt };
  }

  inflight = (async () => {
    const fp = await projectsFingerprint();
    if (fp === cachedFingerprint && cachedAt !== 0) {
      cachedAt = Date.now();
      return cached;
    }
    cached = await scanEvents();
    cachedFingerprint = fp;
    cachedAt = Date.now();
    return cached;
  })();

  try {
    await inflight;
  } finally {
    inflight = null;
  }
  return { events: cached, computedAt: cachedAt };
}

/**
 * The current events fingerprint (newest jsonl mtime). Changes only when the
 * scanned files change — used as the validity token for builder-output memoization
 * (see builder-cache.ts). Reuses what getEvents() already computed; never rescans.
 */
export function eventsFingerprint(): number {
  return cachedFingerprint;
}
