/**
 * cache.ts — compatibility facade over data.ts.
 *
 * The scan/cache stack used to live here: a 5s TTL around scan.ts::scanEvents,
 * paralleled by a second, independent one inside insights-scan.ts. Both walked the
 * same tree and parsed the same ~1.1 GB separately on every cold start.
 *
 * data.ts now owns a single pass that feeds both, backed by a per-file row cache
 * that persists across restarts. This file stays so the existing call sites keep
 * working unchanged.
 */
export { getEvents, dataFingerprint as eventsFingerprint } from './data.ts';
