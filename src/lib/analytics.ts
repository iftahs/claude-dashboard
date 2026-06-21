import posthog from 'posthog-js';

// ── Anonymous product analytics (PostHog) ───────────────────────────────────
// Tells the author how many people run this open-source dashboard and which
// features they use. NO personal data, tokens, file/project paths, session IDs,
// or transcript content is ever sent — only the explicit, hand-written events
// below (see `track`) plus path-only pageviews (tab names like /live, /trends).
//
// Autocapture and session replay are DISABLED on purpose: the UI renders local
// project paths and session IDs, and autocapture would scrape that DOM text.
//
// The project token is a *publishable, ingest-only* client key (it can write
// events but cannot read any data), so it is safe to ship in the public bundle.
// Fork? Override with VITE_POSTHOG_TOKEN at build time.

const PLACEHOLDER_TOKEN = 'phc_REPLACE_WITH_YOUR_POSTHOG_PROJECT_TOKEN';
const DEFAULT_TOKEN = 'phc_sAQMSNXAegoawRUwFiyQZkMDdTtzdaeVb2xVAawBRnA7';
// Use `||` not `??`: a build-time env baked as an empty string (e.g. Docker's
// `ENV VITE_POSTHOG_TOKEN=$VITE_POSTHOG_TOKEN` with the arg unset) must fall
// back to the default — `??` would keep the empty string and disable analytics.
const TOKEN: string = import.meta.env.VITE_POSTHOG_TOKEN || DEFAULT_TOKEN;
const API_HOST: string = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';

const OPTOUT_KEY = 'claude-dashboard-analytics-optout';

/** Runtime user opt-out, persisted in localStorage (mirrors useLimits/useSettings). */
export function isOptedOut(): boolean {
  try {
    return localStorage.getItem(OPTOUT_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Telemetry runs only when ALL of these hold:
 *  - production build  — dev contributors never pollute the data
 *  - not disabled at build time (VITE_DISABLE_ANALYTICS=1)
 *  - a real project token is configured (placeholder ⇒ permanent no-op)
 *  - the user has not opted out at runtime (Settings → Telemetry)
 */
export function analyticsEnabled(): boolean {
  return (
    import.meta.env.PROD &&
    import.meta.env.VITE_DISABLE_ANALYTICS !== '1' &&
    TOKEN !== PLACEHOLDER_TOKEN &&
    !isOptedOut()
  );
}

let started = false;

export function initAnalytics(): void {
  if (started || !analyticsEnabled()) return;
  started = true;
  posthog.init(TOKEN, {
    api_host: API_HOST,
    autocapture: false, // never scrape DOM text → no local paths / PII leak
    capture_pageview: true, // path-only pageviews (tab names) = safe
    disable_session_recording: true,
    capture_performance: false,
    defaults: '2026-01-30',
  });
}

type EventProps = Record<string, string | number | boolean | null | undefined>;

/**
 * Send one explicit, path-free event. No-op unless analytics is started.
 * Only pass allow-listed, non-PII properties (tab id, control name, format) —
 * never project paths, cwd, session ids, or transcript text.
 */
export function track(event: string, props?: EventProps): void {
  if (!started) return;
  posthog.capture(event, props);
}

/** Attach coarse segmentation (plan tier, usage mode) as super-properties. */
export function setUserContext(ctx: { plan?: string | null; usageMode?: string | null }): void {
  if (!started) return;
  posthog.register({
    plan: ctx.plan ?? 'unknown',
    usage_mode: ctx.usageMode ?? 'unknown',
  });
}

/** Flip the runtime opt-out and (de)activate capturing immediately. */
export function setOptOut(optOut: boolean): void {
  try {
    if (optOut) localStorage.setItem(OPTOUT_KEY, '1');
    else localStorage.removeItem(OPTOUT_KEY);
  } catch {
    /* localStorage unavailable — best effort */
  }
  if (started) {
    if (optOut) posthog.opt_out_capturing();
    else posthog.opt_in_capturing();
  } else if (!optOut) {
    initAnalytics(); // re-enable mid-session if every other condition now holds
  }
}
