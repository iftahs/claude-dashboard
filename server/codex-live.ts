/**
 * codex-live.ts
 * Live plan limits + profile stats for OpenAI Codex (the ChatGPT desktop app's
 * coding agent), done the same way as the Claude side: reuse the token Codex
 * already stores locally (`<codexDir>/auth.json`), call ChatGPT's backend, strip
 * every identifying field, and fall back to the newest rollout's `token_count`
 * snapshot when the network is unavailable.
 *
 * Deliberately NO refresh flow: Codex rotates refresh tokens, so a second
 * consumer could invalidate the desktop app's login. When the access token has
 * expired the only fix is opening the ChatGPT app, and the error says so.
 * `id_token` / `refresh_token` are never read past the JSON parse and never
 * returned from this module.
 */

import { open, readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { codexDir } from './scan.ts';

// ---------------------------------------------------------------------------
// Shapes — mirror src/types.ts exactly (CodexWindow / CodexLiveData / CodexProfileStats)
// ---------------------------------------------------------------------------

export interface CodexWindow {
  usedPct: number;          // 0–100
  windowSec: number;        // 18000 (5-hour) or 604800 (weekly)
  resetsAt: string | null;  // ISO; null when the window has lapsed / is unknown
}

export interface CodexLiveData {
  planType: string | null;
  fiveHour: CodexWindow | null;
  weekly: CodexWindow | null;
  limitReached: boolean;
  credits: { hasCredits: boolean; unlimited: boolean; balance: string | null; overageLimitReached: boolean } | null;
  resetCredits: { available: number; applicable: number } | null;
  modelAvailability: Record<string, boolean>;
  origin: 'live' | 'passive';
  snapshotAt: string | null;
  error?: string;
}

export interface CodexProfileStats {
  lifetimeTokens: number;
  peakDailyTokens: number;
  currentStreakDays: number;
  longestStreakDays: number;
  totalThreads: number;
  longestRunningTurnSec: number;
  mostUsedReasoningEffort: string | null;
  mostUsedReasoningEffortPct: number | null;
  dailyUsage: { date: string; tokens: number }[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants / small helpers
// ---------------------------------------------------------------------------

const CODEX_API_BASE = 'https://chatgpt.com/backend-api';
const USAGE_TTL_MS = 30_000;
const PROFILE_TTL_MS = 30 * 60_000;
const FETCH_TIMEOUT_MS = 15_000;
const FIVE_HOUR_SEC = 5 * 3600;
const WEEK_SEC = 7 * 24 * 3600;
/** Tail window for the passive snapshot — guardian review prompts can be a few hundred KB per line. */
const PASSIVE_TAIL_BYTES = 512 * 1024;
/** Tail window when only the last record's timestamp is needed. */
const TS_TAIL_BYTES = 256 * 1024;
/** Newest-first rollouts to try before giving up on a passive snapshot. */
const PASSIVE_CANDIDATES = 5;

const EXPIRED_MSG = 'Codex token expired — open the ChatGPT desktop app to refresh it.';

/** Every rollout record starts with its timestamp — cheap to extract without JSON.parse. */
export const ROLLOUT_TS_RE = /^\{"timestamp":"([^"]+)"/;

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function clampPct(v: unknown): number {
  return Math.max(0, Math.min(100, num(v)));
}

/** Auth-shaped failures (missing/expired/rejected token) — never masked by the passive fallback. */
class CodexAuthError extends Error {}

// ---------------------------------------------------------------------------
// auth.json
// ---------------------------------------------------------------------------

export interface CodexAuth {
  accessToken: string;
  accountId: string;
  /** From the JWT's `chatgpt_plan_type` claim ('plus' | 'go' | 'pro' | 'team' | …). */
  planType: string | null;
  /** ms epoch from the JWT `exp` claim; null when the token carries none. */
  expiresAt: number | null;
}

/** Decode a JWT payload segment (base64url) without a library. Null on any malformation. */
function decodeJwtPayload(token: string): any | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Read `<codexDir>/auth.json` → the access token plus what its JWT says about
 * expiry and plan. Returns null when the file or the token is missing (API-key
 * logins have `tokens: null`). Only the access token and account id leave here.
 */
export async function readCodexAuth(): Promise<CodexAuth | null> {
  let json: any;
  try {
    json = JSON.parse(await readFile(join(codexDir(), 'auth.json'), 'utf8'));
  } catch {
    return null;
  }
  const accessToken = json?.tokens?.access_token;
  if (typeof accessToken !== 'string' || !accessToken) return null;
  const claims = decodeJwtPayload(accessToken);
  const authClaim = claims?.['https://api.openai.com/auth'] ?? {};
  const accountId = String(json.tokens?.account_id ?? authClaim.chatgpt_account_id ?? '');
  return {
    accessToken,
    accountId,
    planType: typeof authClaim.chatgpt_plan_type === 'string' ? authClaim.chatgpt_plan_type : null,
    expiresAt: typeof claims?.exp === 'number' ? claims.exp * 1000 : null,
  };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function codexHeaders(auth: CodexAuth): Record<string, string> {
  return {
    'Authorization': `Bearer ${auth.accessToken}`,
    'ChatGPT-Account-Id': auth.accountId,
    'Accept': 'application/json',
    'User-Agent': 'claude-dashboard',
  };
}

/** GET with a 15s timeout, retrying a 5xx once (4xx return immediately — see oauthGet in scan.ts). */
async function codexGet(url: string, auth: CodexAuth): Promise<Response> {
  const headers = codexHeaders(auth);
  let res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (res.status >= 500) {
    await new Promise((r) => setTimeout(r, 500));
    res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  }
  return res;
}

async function codexJson(path: string, auth: CodexAuth, what: string): Promise<any> {
  const res = await codexGet(`${CODEX_API_BASE}${path}`, auth);
  if (res.status === 401) {
    throw new CodexAuthError('Codex token expired or revoked (401) — open the ChatGPT desktop app to refresh it.');
  }
  if (res.status === 403) {
    throw new CodexAuthError('Codex token rejected (403) — sign in again in the ChatGPT desktop app.');
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch Codex ${what}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function describeFetchError(e: any): string {
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return `Codex request timed out after ${FETCH_TIMEOUT_MS / 1000}s`;
  const msg: string = e?.message || String(e);
  const cause = e?.cause?.code ? ` (${e.cause.code})` : '';
  return msg + cause;
}

// ---------------------------------------------------------------------------
// Window classification (shared by live + passive)
// ---------------------------------------------------------------------------

/**
 * Slot windows by their LENGTH, never by primary/secondary position — the 'go'
 * plan reports a weekly primary and no secondary. Exact 5h/7d lengths win;
 * anything else fills whichever slot is still empty, shorter windows first.
 */
function assignWindows(windows: CodexWindow[]): { fiveHour: CodexWindow | null; weekly: CodexWindow | null } {
  let fiveHour: CodexWindow | null = null;
  let weekly: CodexWindow | null = null;
  const rest: CodexWindow[] = [];
  for (const w of windows) {
    if (w.windowSec === FIVE_HOUR_SEC && !fiveHour) fiveHour = w;
    else if (w.windowSec === WEEK_SEC && !weekly) weekly = w;
    else rest.push(w);
  }
  rest.sort((a, b) => a.windowSec - b.windowSec);
  for (const w of rest) {
    const shortish = w.windowSec < 24 * 3600;
    if (shortish && !fiveHour) fiveHour = w;
    else if (!weekly) weekly = w;
    else if (!fiveHour) fiveHour = w;
  }
  return { fiveHour, weekly };
}

// ---------------------------------------------------------------------------
// Live usage — GET /wham/usage
// ---------------------------------------------------------------------------

function epochToIso(epochSec: unknown, resetAfterSec?: unknown): string | null {
  if (typeof epochSec === 'number' && Number.isFinite(epochSec) && epochSec > 0) {
    return new Date(epochSec * 1000).toISOString();
  }
  if (typeof resetAfterSec === 'number' && Number.isFinite(resetAfterSec)) {
    return new Date(Date.now() + resetAfterSec * 1000).toISOString();
  }
  return null;
}

function liveWindow(w: any): CodexWindow | null {
  if (!w || typeof w !== 'object') return null;
  const windowSec = num(w.limit_window_seconds);
  if (windowSec <= 0) return null;
  return {
    usedPct: clampPct(w.used_percent),
    windowSec,
    resetsAt: epochToIso(w.reset_at, w.reset_after_seconds),
  };
}

/**
 * Normalise the `/wham/usage` payload. `user_id`, `account_id` and `email` are
 * dropped here — nothing below this line ever sees them again.
 */
function normalizeLiveUsage(raw: any, fallbackPlan: string | null): CodexLiveData {
  const rl = raw?.rate_limit ?? {};
  const windows: CodexWindow[] = [];
  for (const w of [liveWindow(rl.primary_window), liveWindow(rl.secondary_window)]) {
    if (w) windows.push(w);
  }
  const { fiveHour, weekly } = assignWindows(windows);

  const c = raw?.credits;
  const credits = c && typeof c === 'object'
    ? {
        hasCredits: !!c.has_credits,
        unlimited: !!c.unlimited,
        balance: c.balance != null ? String(c.balance) : null,
        overageLimitReached: !!c.overage_limit_reached,
      }
    : null;

  const rc = raw?.rate_limit_reset_credits;
  const resetCredits = rc && typeof rc === 'object'
    ? { available: num(rc.available_count), applicable: num(rc.applicable_available_count) }
    : null;

  const modelAvailability: Record<string, boolean> = {};
  const mu = raw?.model_usage;
  if (mu && typeof mu === 'object') {
    for (const [slug, info] of Object.entries<any>(mu)) modelAvailability[slug] = !!info?.available;
  }

  return {
    planType: typeof raw?.plan_type === 'string' ? raw.plan_type : fallbackPlan,
    fiveHour,
    weekly,
    limitReached: !!rl.limit_reached,
    credits,
    resetCredits,
    modelAvailability,
    origin: 'live',
    snapshotAt: null,
  };
}

let usageCache: { data: CodexLiveData; fetchedAt: number } | null = null;

/**
 * Current Codex plan limits. Live from ChatGPT when the stored token works;
 * otherwise the newest local `token_count` snapshot (origin 'passive', with an
 * `error` describing why live failed). Auth problems (no login, expired,
 * 401/403) throw — those need the user, not a stale snapshot.
 */
export async function fetchCodexUsage(): Promise<CodexLiveData> {
  if (usageCache && Date.now() - usageCache.fetchedAt < USAGE_TTL_MS) return usageCache.data;

  const auth = await readCodexAuth();
  let liveError: string;
  if (!auth) {
    liveError = 'No Codex login found (auth.json missing or has no access token).';
  } else {
    if (auth.expiresAt !== null && Date.now() >= auth.expiresAt) throw new Error(EXPIRED_MSG);
    try {
      const data = normalizeLiveUsage(await codexJson('/wham/usage', auth, 'usage'), auth.planType);
      usageCache = { data, fetchedAt: Date.now() };
      return data;
    } catch (e: any) {
      if (e instanceof CodexAuthError) throw e;
      liveError = describeFetchError(e);
    }
  }

  const passive = await readPassiveRateLimits();
  if (!passive) throw new Error(`${liveError} No local rollout snapshot to fall back on.`);
  const data: CodexLiveData = {
    ...passive,
    planType: passive.planType ?? auth?.planType ?? null,
    error: `Live usage unavailable (${liveError}) — showing the newest local snapshot.`,
  };
  usageCache = { data, fetchedAt: Date.now() };
  return data;
}

// ---------------------------------------------------------------------------
// Passive snapshot — newest rollout's last token_count.rate_limits
// ---------------------------------------------------------------------------

export interface RolloutFile {
  path: string;
  size: number;
  mtime: number;
  birthtime: number;
}

/** Every `rollout-*.jsonl` under `<codexDir>/sessions/**`. Fail-soft: [] when the dir is missing. */
export async function listRollouts(): Promise<RolloutFile[]> {
  const out: RolloutFile[] = [];
  const walk = async (dir: string): Promise<void> => {
    let dirents;
    try {
      dirents = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of dirents) {
      const full = join(dir, d.name);
      if (d.isDirectory()) {
        await walk(full);
      } else if (d.isFile() && /^rollout-.*\.jsonl$/.test(d.name)) {
        try {
          const s = await stat(full);
          out.push({ path: full, size: s.size, mtime: s.mtimeMs, birthtime: s.birthtimeMs });
        } catch { /* vanished mid-walk */ }
      }
    }
  };
  await walk(join(codexDir(), 'sessions'));
  return out;
}

/** Thread id baked into the rollout filename: rollout-<ts>-<uuid>.jsonl. '' if the name is unusual. */
export function rolloutThreadId(path: string): string {
  const m = /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i.exec(path);
  return m ? m[1].toLowerCase() : '';
}

/** Read the last `bytes` of a file as UTF-8 (same pattern as readSessionCwd in auto-resume.ts). */
export async function readTail(path: string, bytes: number): Promise<string> {
  const st = await stat(path);
  const len = Math.min(bytes, st.size);
  if (len === 0) return '';
  const fh = await open(path, 'r');
  try {
    const buf = Buffer.alloc(len);
    const { bytesRead } = await fh.read(buf, 0, len, st.size - len);
    return buf.toString('utf8', 0, bytesRead);
  } finally {
    await fh.close();
  }
}

/**
 * Timestamp (ms) of the last complete record in the file's tail, or null when
 * the tail window holds no line start (a single multi-MB record). Guardian
 * rollouts keep their birth mtime forever, so this — not mtime — is "recency".
 */
export async function lastRecordTs(path: string): Promise<number | null> {
  try {
    const lines = (await readTail(path, TS_TAIL_BYTES)).split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = ROLLOUT_TS_RE.exec(lines[i]);
      if (!m) continue;
      const ts = Date.parse(m[1]);
      if (!Number.isNaN(ts)) return ts;
    }
  } catch { /* unreadable */ }
  return null;
}

function passiveWindow(w: any, now: number): CodexWindow | null {
  if (!w || typeof w !== 'object') return null;
  const windowSec = num(w.window_minutes) * 60;
  if (windowSec <= 0) return null;
  const resetsMs = num(w.resets_at) * 1000;
  // The snapshot can be days old — a window whose reset already passed says nothing about now.
  if (resetsMs > 0 && now >= resetsMs) return null;
  return {
    usedPct: clampPct(w.used_percent),
    windowSec,
    resetsAt: resetsMs > 0 ? new Date(resetsMs).toISOString() : null,
  };
}

/** Last `token_count` record with `rate_limits` in the file's tail → CodexLiveData, or null. */
async function snapshotFromTail(path: string, now: number): Promise<CodexLiveData | null> {
  let lines: string[];
  try {
    lines = (await readTail(path, PASSIVE_TAIL_BYTES)).split('\n');
  } catch {
    return null;
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    // Cheap string gates before the JSON.parse: it's an event_msg, a token_count, and carries rate_limits.
    if (!line.startsWith('{"timestamp":"') || !line.includes('"type":"token_count"') || !line.includes('"rate_limits":{')) continue;
    let obj: any;
    try { obj = JSON.parse(line); } catch { continue; }
    if (obj?.type !== 'event_msg' || obj.payload?.type !== 'token_count') continue;
    const rl = obj.payload.rate_limits;
    if (!rl || typeof rl !== 'object') continue;

    const windows: CodexWindow[] = [];
    for (const w of [passiveWindow(rl.primary, now), passiveWindow(rl.secondary, now)]) {
      if (w) windows.push(w);
    }
    const { fiveHour, weekly } = assignWindows(windows);
    const c = rl.credits;
    const snapshotTs = Date.parse(obj.timestamp ?? '');
    return {
      planType: typeof rl.plan_type === 'string' ? rl.plan_type : null,
      fiveHour,
      weekly,
      // A "reached" flag only means something while the window it refers to hasn't lapsed.
      limitReached: rl.rate_limit_reached_type != null && (fiveHour !== null || weekly !== null),
      credits: c && typeof c === 'object'
        ? { hasCredits: !!c.has_credits, unlimited: !!c.unlimited, balance: c.balance != null ? String(c.balance) : null, overageLimitReached: false }
        : null,
      resetCredits: null,
      modelAvailability: {},
      origin: 'passive',
      snapshotAt: Number.isNaN(snapshotTs) ? null : new Date(snapshotTs).toISOString(),
    };
  }
  return null;
}

/**
 * Offline fallback: the newest rollout — by LAST RECORD TIMESTAMP, since guardian
 * files never update their mtime — and its last `token_count.rate_limits`. Tries
 * the next-newest few files when the newest tail has none. Null when nothing usable.
 */
export async function readPassiveRateLimits(): Promise<CodexLiveData | null> {
  const now = Date.now();
  const files = await listRollouts();
  if (files.length === 0) return null;
  const ranked = await Promise.all(
    files.map(async (f) => ({ ...f, lastTs: (await lastRecordTs(f.path)) ?? f.mtime })),
  );
  ranked.sort((a, b) => b.lastTs - a.lastTs);
  for (const f of ranked.slice(0, PASSIVE_CANDIDATES)) {
    const snap = await snapshotFromTail(f.path, now);
    if (snap) return snap;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Profile stats — GET /wham/profiles/me (stats only; the `profile` block is dropped)
// ---------------------------------------------------------------------------

let profileCache: { data: CodexProfileStats; fetchedAt: number } | null = null;

export async function fetchCodexProfile(): Promise<CodexProfileStats> {
  if (profileCache && Date.now() - profileCache.fetchedAt < PROFILE_TTL_MS) return profileCache.data;

  const auth = await readCodexAuth();
  if (!auth) throw new Error('No Codex login found (auth.json missing or has no access token).');
  if (auth.expiresAt !== null && Date.now() >= auth.expiresAt) throw new Error(EXPIRED_MSG);

  let raw: any;
  try {
    raw = await codexJson('/wham/profiles/me', auth, 'profile');
  } catch (e: any) {
    if (e instanceof CodexAuthError) throw e;
    throw new Error(describeFetchError(e));
  }
  const s = raw?.stats ?? {};
  const buckets: any[] = Array.isArray(s.daily_usage_buckets) ? s.daily_usage_buckets : [];
  const dailyUsage = buckets
    .map((b) => ({ date: typeof b?.start_date === 'string' ? b.start_date : '', tokens: num(b?.tokens) }))
    .filter((b) => b.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const data: CodexProfileStats = {
    lifetimeTokens: num(s.lifetime_tokens),
    peakDailyTokens: num(s.peak_daily_tokens),
    currentStreakDays: num(s.current_streak_days),
    longestStreakDays: num(s.longest_streak_days),
    totalThreads: num(s.total_threads),
    longestRunningTurnSec: num(s.longest_running_turn_sec),
    mostUsedReasoningEffort: typeof s.most_used_reasoning_effort === 'string' ? s.most_used_reasoning_effort : null,
    mostUsedReasoningEffortPct:
      typeof s.most_used_reasoning_effort_percentage === 'number' && Number.isFinite(s.most_used_reasoning_effort_percentage)
        ? s.most_used_reasoning_effort_percentage
        : null,
    dailyUsage,
  };
  profileCache = { data, fetchedAt: Date.now() };
  return data;
}
