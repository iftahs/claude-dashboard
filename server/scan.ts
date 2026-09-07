import { readdir, readFile, writeFile, rename } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isDocker } from './version.ts';

const execFileAsync = promisify(execFile);

const CLAUDE_CODE_UA = 'claude-code/2.1.199'; // keep roughly in step with the CLI

export type UsageSource = 'code' | 'cowork' | 'codex';

export interface UsageEvent {
  ts: number; // epoch ms
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  tools: string[]; // tool_use names invoked in this assistant message
  isSidechain: boolean; // true when this message is a subagent (Task) sub-response
  rootSessionId: string; // top-level session — for subagents, the parent that spawned them
  // Per-request attribution written by the CLI itself (same tags Claude's usage
  // view reads) — '' when absent. These make our breakdown match Claude exactly.
  attributionAgent: string; // subagent type this request ran under
  attributionSkill: string; // skill this request ran under
  attributionMcpServer: string; // MCP server whose results sit in this request's context
  attributionPlugin: string; // plugin this request ran under
  projectPath: string; // decoded path of the project directory
  gitBranch: string; // git branch at the time of the message ('' if unknown)
  source: UsageSource; // 'code' = Claude Code CLI, 'cowork' = desktop local-agent mode, 'codex' = OpenAI Codex (ChatGPT desktop)
}

export function claudeDir(): string {
  return process.env.CLAUDE_DIR || join(homedir(), '.claude');
}

/**
 * OpenAI Codex home — the ChatGPT desktop app's coding agent writes its rollouts,
 * auth and sidecars here. Same path on every OS; `CODEX_HOME` is Codex's own
 * override and `CODEX_DIR` ours (used by the Docker mount).
 */
export function codexDir(): string {
  return process.env.CODEX_DIR || process.env.CODEX_HOME || join(homedir(), '.codex');
}

function projectsDir(): string {
  return join(claudeDir(), 'projects');
}

/**
 * Claude Cowork ("local agent mode" in the desktop app) writes standard Claude
 * Code JSONL transcripts under
 *   <coworkDir>/<acct>/<profile>/<sessionId>/.claude/projects/**\/*.jsonl
 * The desktop-app data root differs per OS. `COWORK_DIR` overrides it (used by
 * the Docker mount). Returns '' when no plausible default exists.
 */
function coworkDir(): string {
  if (process.env.COWORK_DIR) return process.env.COWORK_DIR;
  const home = homedir();
  switch (platform()) {
    case 'win32': {
      const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming');
      return join(appData, 'Claude', 'local-agent-mode-sessions');
    }
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'Claude', 'local-agent-mode-sessions');
    default:
      return join(home, '.config', 'Claude', 'local-agent-mode-sessions');
  }
}

export interface ScanRoot {
  dir: string;
  source: UsageSource;
}

/**
 * The directories scanned for usage events. Always the Claude Code projects dir;
 * plus the Cowork desktop root when it exists on disk. Both the main scanner and
 * the insights scanner walk this same list so the two stay in sync.
 */
export function scanRoots(): ScanRoot[] {
  const roots: ScanRoot[] = [{ dir: projectsDir(), source: 'code' }];
  const cw = coworkDir();
  if (cw) roots.push({ dir: cw, source: 'cowork' });
  return roots;
}

/**
 * Cowork roots contain metadata (`local_*.json`), audit logs (`audit.jsonl`) and
 * the nested `.claude/projects/` transcripts. Only the latter carry token usage,
 * so cowork files are kept only when their path sits under a `.claude/projects/`
 * segment. Code files are always kept. Codex roots are kept only for
 * `rollout-*.jsonl` transcripts — that name guard is what lets the Docker compose
 * fallback (mounting `.claude` at the codex path) yield zero codex files.
 */
export function keepScanFile(file: string, source: UsageSource): boolean {
  if (source === 'code') return true;
  if (source === 'codex') return /[\\/]rollout-[^\\/]*\.jsonl$/i.test(file);
  return /[\\/]\.claude[\\/]projects[\\/]/.test(file);
}

// The recursive walk, the fingerprint and the JSONL parser that used to live here
// now belong to scan-pass.ts, which does one pass feeding both usage and insights.
// This module keeps the path/root helpers above and the sidecar/network readers below.

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export async function readConfig(): Promise<any> {
  try {
    const filePath = join(claudeDir(), 'settings.json');
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error('[server] failed to read settings.json:', e);
    return null;
  }
}

/**
 * On macOS, Claude Code keeps the real OAuth token in the Keychain (service
 * "Claude Code-credentials") rather than in `.credentials.json` — the on-disk
 * file may only hold unrelated `mcpOAuth` entries. Used as a fallback when the
 * file has no `claudeAiOauth` block. Only reachable when running directly on
 * the host (e.g. `npm run dev`) — a Docker container can't reach the host
 * Keychain, which is what `.dashboard-oauth-cache.json` below is for.
 */
async function readKeychainCredentials(): Promise<any> {
  try {
    const { stdout } = await execFileAsync('security', [
      'find-generic-password', '-s', 'Claude Code-credentials', '-w',
    ]);
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

/**
 * `scripts/sync-macos-keychain.mjs` (run on the host before `docker compose
 * up`) copies the Keychain's `claudeAiOauth` block here, inside `~/.claude` —
 * which Docker already bind-mounts read-only — so the container can see it
 * too.
 */
async function readCachedKeychainCredentials(): Promise<any> {
  try {
    const filePath = join(claudeDir(), '.dashboard-oauth-cache.json');
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function readCredentials(): Promise<any> {
  let fileCredentials: any = null;
  try {
    const filePath = join(claudeDir(), '.credentials.json');
    const content = await readFile(filePath, 'utf8');
    fileCredentials = JSON.parse(content);
  } catch (e) {
    console.error('[server] failed to read .credentials.json:', e);
  }

  const cachedCredentials = await readCachedKeychainCredentials();
  const fileOauth = fileCredentials?.claudeAiOauth;
  const cachedOauth = cachedCredentials?.claudeAiOauth;

  // When both on-disk sources hold a token, prefer whichever expires LATEST: a
  // stale .credentials.json must not shadow a cache the token-sync LaunchAgent
  // just refreshed — and vice versa. Ties keep the historical file precedence.
  if (fileOauth?.accessToken && cachedOauth?.accessToken) {
    return (cachedOauth.expiresAt ?? 0) > (fileOauth.expiresAt ?? 0)
      ? cachedCredentials
      : fileCredentials;
  }
  if (fileOauth?.accessToken) return fileCredentials;
  if (cachedOauth?.accessToken) return cachedCredentials;

  if (platform() !== 'darwin') return fileCredentials;

  const keychainCredentials = await readKeychainCredentials();
  return keychainCredentials?.claudeAiOauth ? keychainCredentials : fileCredentials;
}

/**
 * One captured token from the ring, plus whether it's the account currently in
 * the shared Keychain/cache slot (what `readCredentials()` returns). The token
 * blob carries NO stable account id — org/account/email come only from the OAuth
 * profile — so identity resolution + per-account dedup happens at serve time in
 * the `/api/accounts/live` handler, not here.
 */
export interface CapturedToken {
  claudeAiOauth: any;
  capturedAt: number;
  isActive: boolean;
}

const ACCOUNTS_FILE = '.dashboard-accounts.json';
const MAX_RECORDED_TOKENS = 8;

async function readTokenRing(): Promise<any[]> {
  try {
    const parsed = JSON.parse(await readFile(join(claudeDir(), ACCOUNTS_FILE), 'utf8'));
    return Array.isArray(parsed?.tokens)
      ? parsed.tokens.filter((t: any) => t?.claudeAiOauth?.accessToken)
      : [];
  } catch {
    return [];
  }
}

/**
 * Host-only: append the currently-active token to the ring so an account keeps
 * showing after you switch away from it (Claude Code shares one Keychain slot,
 * so the next login overwrites it). Deduped by accessToken, capped, network-free
 * — mirrors `recordToken()` in `sync-macos-keychain.mjs`. Skipped in Docker: the
 * `~/.claude` mount is read-only there, so the host sync script owns capture,
 * exactly like `.dashboard-oauth-cache.json`. Best-effort — never throws.
 */
async function captureActiveToken(primary: any): Promise<void> {
  if (isDocker()) return;
  const oauth = primary?.claudeAiOauth;
  if (!oauth?.accessToken) return;
  try {
    const tokens = await readTokenRing();
    if (tokens.some((t) => t.claudeAiOauth.accessToken === oauth.accessToken)) return;
    tokens.unshift({ claudeAiOauth: oauth, capturedAt: Date.now() });
    const filePath = join(claudeDir(), ACCOUNTS_FILE);
    const tmp = `${filePath}.tmp`;
    await writeFile(tmp, JSON.stringify({ tokens: tokens.slice(0, MAX_RECORDED_TOKENS) }, null, 2), { encoding: 'utf8', mode: 0o600 });
    await rename(tmp, filePath);
  } catch {
    // best-effort — never break the request path over a token snapshot
  }
}

/**
 * Every captured token the dashboard knows about (the ring) plus the
 * currently-active one folded in, so the active account shows even before the
 * ring is first written (e.g. Docker before the first sync captures it). The
 * `/api/accounts/live` handler resolves identity and dedups these into accounts.
 */
export async function readAccountCredentials(): Promise<CapturedToken[]> {
  const primary = await readCredentials();
  await captureActiveToken(primary);

  const primaryToken = primary?.claudeAiOauth?.accessToken;
  const list: CapturedToken[] = (await readTokenRing()).map((t) => ({
    claudeAiOauth: t.claudeAiOauth,
    capturedAt: t.capturedAt ?? 0,
    isActive: t.claudeAiOauth.accessToken === primaryToken,
  }));
  if (primaryToken && !list.some((t) => t.isActive)) {
    list.unshift({ claudeAiOauth: primary.claudeAiOauth, capturedAt: Date.now(), isActive: true });
  }
  return list;
}

/**
 * User-facing "token expired" advice differs by runtime: on the host, running
 * any Claude Code command refreshes the Keychain/.credentials.json in place —
 * but the Docker container reads a host-written snapshot, so only re-syncing
 * that file helps. Keep the word "expired" in both: the frontend classifies
 * this state by matching it.
 */
export function expiredTokenMessage(): string {
  return isDocker()
    ? 'OAuth token expired — the cached token the container reads is stale. On your Mac run `npm run token-sync`, or `npm run docker:up` (which installs the auto-refresh agent).'
    : 'OAuth token expired — run any Claude Code command in your terminal to refresh it automatically.';
}

export async function readStatsSummary(): Promise<any> {
  try {
    const filePath = join(claudeDir(), 'stats-cache.json');
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error('[server] failed to read stats-cache.json:', e);
    return null;
  }
}

export async function readSessionMetas(): Promise<any[]> {
  try {
    const dirPath = join(claudeDir(), 'usage-data', 'session-meta');
    const dirents = await readdir(dirPath, { withFileTypes: true });
    const jsonFiles = dirents
      .filter((d) => d.isFile() && d.name.endsWith('.json'))
      .map((d) => join(dirPath, d.name));

    const sessions = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const content = await readFile(file, 'utf8');
          return JSON.parse(content);
        } catch {
          return null;
        }
      })
    );

    return sessions
      .filter(Boolean)
      .sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time));
  } catch (e) {
    console.error('[server] failed to read session-meta:', e);
    return [];
  }
}

// Keyed by account (organizationUuid) so a second account can be cached
// alongside the first — the multi-account live view fetches one entry per token.
const liveUsageCache = new Map<string, { data: any; fetchedAt: number }>();
const liveProfileCache = new Map<string, { data: any; fetchedAt: number }>();

const CACHE_TTL = 30000; // 30 seconds local cache to avoid rate limit issues
const PROFILE_TTL = 30 * 60 * 1000; // 30 min — the plan changes rarely

/** Shared headers for Anthropic's OAuth endpoints (usage + profile + messages). */
export function oauthHeaders(accessToken: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'anthropic-beta': 'oauth-2025-04-20',
    'User-Agent': CLAUDE_CODE_UA,
    'Accept': 'application/json',
  };
}

/**
 * GET an Anthropic OAuth endpoint, retrying transient 5xx with short backoff.
 * 4xx (incl. 403 / 429) return immediately — retrying auth failures or rate
 * limits only makes things worse.
 */
async function oauthGet(url: string, accessToken: string): Promise<Response> {
  const headers = oauthHeaders(accessToken);
  const backoffs = [250, 750]; // ms → 3 attempts total
  let res = await fetch(url, { headers });
  for (const wait of backoffs) {
    if (res.status < 500) return res;
    await new Promise((r) => setTimeout(r, wait));
    res = await fetch(url, { headers });
  }
  return res;
}

/**
 * Live usage for a specific token, cached per `key` (an account/org id). The
 * no-arg `fetchLiveUsage()` below wraps this for the currently-active account so
 * `/api/usage/live` behaves exactly as before; `/api/accounts/live` calls it
 * once per captured account.
 */
export async function fetchLiveUsageFor(accessToken: string, key: string, expiresAt?: number): Promise<any> {
  const cached = liveUsageCache.get(key);
  if (cached && (Date.now() - cached.fetchedAt < CACHE_TTL)) {
    return cached.data;
  }
  if (!accessToken) {
    throw new Error('No access token found in credentials');
  }
  if (expiresAt && Date.now() >= expiresAt) {
    throw new Error(expiredTokenMessage());
  }

  // OAUTH_API_BASE: test-only override so the auto-resume detection loop can be
  // driven end-to-end by a local mock without exhausting a real limit.
  const url = `${process.env.OAUTH_API_BASE || 'https://api.anthropic.com'}/api/oauth/usage`;
  const res = await oauthGet(url, accessToken);
  if (res.status === 401) {
    // Expiry the local expiresAt check misses (clock skew, server-side
    // revocation) — word it as "expired" so the frontend classifies it right.
    throw new Error(`OAuth token expired or revoked (401). ${expiredTokenMessage()}`);
  }
  if (res.status === 403) {
    throw new Error('OAuth token invalid (403). Please run any command in Claude CLI to refresh.');
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch live usage from Anthropic API: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  liveUsageCache.set(key, { data, fetchedAt: Date.now() });
  return data;
}

export async function fetchLiveUsage(): Promise<any> {
  const credentials = await readCredentials();
  const oauth = credentials?.claudeAiOauth;
  if (!oauth?.accessToken) {
    throw new Error('No access token found in credentials');
  }
  return fetchLiveUsageFor(oauth.accessToken, oauth.accessToken, oauth.expiresAt);
}

/**
 * Live account/plan from Anthropic's OAuth profile endpoint. Returns the plan
 * the user is *actually* on right now — unlike the `subscriptionType` baked into
 * `.credentials.json`, which goes stale after a plan change until the next login.
 * Cached 30 min; throws (caller falls back to the local file) when offline/expired.
 */
/** Live profile for a specific token, cached per `key`. See `fetchLiveUsageFor`. */
export async function fetchLiveProfileFor(accessToken: string, key: string, expiresAt?: number): Promise<any> {
  const cached = liveProfileCache.get(key);
  if (cached && (Date.now() - cached.fetchedAt < PROFILE_TTL)) {
    return cached.data;
  }
  if (!accessToken) {
    throw new Error('No access token found in credentials');
  }
  if (expiresAt && Date.now() >= expiresAt) {
    throw new Error(expiredTokenMessage());
  }

  const res = await oauthGet('https://api.anthropic.com/api/oauth/profile', accessToken);
  if (!res.ok) {
    throw new Error(`Failed to fetch profile from Anthropic API: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  liveProfileCache.set(key, { data, fetchedAt: Date.now() });
  return data;
}

export async function fetchLiveProfile(): Promise<any> {
  const credentials = await readCredentials();
  const oauth = credentials?.claudeAiOauth;
  if (!oauth?.accessToken) {
    throw new Error('No access token found in credentials');
  }
  return fetchLiveProfileFor(oauth.accessToken, oauth.accessToken, oauth.expiresAt);
}

// ── LiteLLM gateway: actual billed cost ──────────────────────────────────────
// When Claude Code runs through a LiteLLM proxy, the gateway tracks the *real*
// per-request cost. The dashboard surfaces it next to the local estimate. Reuses
// the same ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN the AI feature uses, with
// optional dedicated LITELLM_BASE_URL / LITELLM_API_KEY overrides (for a key that
// has spend-view permission, when the chat key doesn't).

/** Strip a trailing slash and/or a trailing /v1 (same normalization as ai.ts). */
function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '').replace(/\/v1$/, '');
}

/** LiteLLM gateway base URL — LITELLM_BASE_URL, else ANTHROPIC_BASE_URL. '' if neither. */
function litellmBaseUrl(): string {
  const raw = process.env.LITELLM_BASE_URL || process.env.ANTHROPIC_BASE_URL || '';
  return raw ? normalizeBaseUrl(raw) : '';
}

/** Virtual-key bearer for the gateway — LITELLM_API_KEY, else ANTHROPIC_AUTH_TOKEN. */
function litellmAuthToken(): string {
  return (process.env.LITELLM_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '').trim();
}

/** Anthropic's own hosts — a base URL pointing here is NOT a third-party gateway. */
function isAnthropicHost(host: string): boolean {
  return /(^|\.)anthropic\.com$/i.test(host) || /(^|\.)claude\.ai$/i.test(host);
}

/**
 * Detect whether a LiteLLM (or compatible) gateway is configured: a non-Anthropic
 * base URL host plus an auth token. Pure env read (no network) — safe to call from
 * /api/config. The frontend gates all LiteLLM UI on `available`.
 */
export function detectLitellm(): { available: boolean; gatewayHost: string } {
  const base = litellmBaseUrl();
  const token = litellmAuthToken();
  if (!base || !token) return { available: false, gatewayHost: '' };
  let host = '';
  try {
    host = new URL(base).host;
  } catch {
    return { available: false, gatewayHost: '' };
  }
  if (!host || isAnthropicHost(host)) return { available: false, gatewayHost: '' };
  return { available: true, gatewayHost: host };
}

export interface LiteLlmSpend {
  monthLabel: string;        // current month, e.g. "Jun 2026"
  monthToDate: number;       // total billed from the 1st → today
  monthRequests: number;
  monthSuccessful: number;   // successful requests this month
  monthFailed: number;       // failed requests this month
  monthTokens: { prompt: number; completion: number; cacheRead: number; cacheCreate: number };
  prevMonthLabel: string;    // previous month, e.g. "May"
  prevMonthToDate: number;   // previous month, 1st → same day-of-month (same-period comparison)
  lifetime: { user: number; key: number }; // lifetime spend (user across all keys / this key)
  // `days` calendar days incl. today, oldest→newest, zero-filled. Per-day cost,
  // request count, successful count, and per-model spend (for the hover breakdown).
  daily: { date: string; cost: number; requests: number; successful: number; byModel: Record<string, number> }[];
}

interface LiteLlmBase {
  byDate: Map<string, { cost: number; requests: number; successful: number; byModel: Record<string, number> }>;
  today: Date;
  monthLabel: string;
  monthToDate: number;
  monthRequests: number;
  monthSuccessful: number;
  monthFailed: number;
  monthTokens: { prompt: number; completion: number; cacheRead: number; cacheCreate: number };
  prevMonthLabel: string;
  prevMonthToDate: number;
}

const LITELLM_TTL = 5 * 60 * 1000; // 5 min — billing data moves slowly
let cachedLiteLlmBase: { key: string; data: LiteLlmBase; fetchedAt: number } | null = null;
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Local YYYY-MM-DD (matches the app's local-tz day bucketing). */
function localYmd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * One self-scoped /user/daily/activity fetch covering previous-month-start → today
 * (enough for month-to-date, the previous-month same-period total, and any daily
 * window up to 28 days). Cached 5 min by date range — independent of the requested
 * `days`, so switching the window reuses the cache. Throws distinct messages so the
 * route can degrade gracefully (no permission / not a LiteLLM gateway / outage).
 */
async function fetchLiteLlmBase(): Promise<LiteLlmBase> {
  const base = litellmBaseUrl();
  const token = litellmAuthToken();
  if (!base || !token) throw new Error('LiteLLM gateway not configured');

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  // Same day-of-month in the previous month, clamped to its last day, for a
  // fair "same point in the month" comparison.
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth() - 1, Math.min(today.getDate(), prevMonthLastDay));
  const startYmd = localYmd(prevMonthStart);
  const endYmd = localYmd(today);
  const monthStartYmd = localYmd(monthStart);
  const prevEndYmd = localYmd(prevMonthEnd);

  const cacheKey = `${startYmd}|${endYmd}`;
  if (cachedLiteLlmBase && cachedLiteLlmBase.key === cacheKey && Date.now() - cachedLiteLlmBase.fetchedAt < LITELLM_TTL)
    return cachedLiteLlmBase.data;

  // /user/daily/activity is paginated (page_size default 50). Use a large page_size
  // and follow has_more so month-to-date / daily aren't undercounted. (We don't pass
  // `timezone`: this gateway validates it as an integer UTC offset, not a tz name, and
  // the totals we sum are tz-independent — so day bucketing stays the gateway default.)
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const results: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = `${base}/user/daily/activity?start_date=${startYmd}&end_date=${endYmd}&page=${page}&page_size=1000`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (page === 1 && (res.status === 401 || res.status === 403))
      throw new Error('LiteLLM rejected the key for spend read (401/403) — the virtual key may lack spend-view permission.');
    if (page === 1 && res.status === 404)
      throw new Error('LiteLLM spend endpoint not found (404) — the gateway may not expose /user/daily/activity.');
    if (!res.ok) throw new Error(`LiteLLM spend fetch failed: ${res.status} ${res.statusText}`);
    const json: any = await res.json();
    if (Array.isArray(json?.results)) results.push(...json.results);
    if (!json?.metadata?.has_more) break;
  }

  // YYYY-MM-DD sorts lexicographically, so date-string range checks work directly.
  const byDate = new Map<string, { cost: number; requests: number; successful: number; byModel: Record<string, number> }>();
  let monthToDate = 0, monthRequests = 0, monthSuccessful = 0, monthFailed = 0, prevMonthToDate = 0;
  const monthTokens = { prompt: 0, completion: 0, cacheRead: 0, cacheCreate: 0 };
  for (const r of results) {
    const date = String(r?.date ?? '');
    if (!date) continue;
    const mx = r?.metrics ?? {};
    const entry = byDate.get(date) ?? { cost: 0, requests: 0, successful: 0, byModel: {} };
    entry.cost += num(mx.spend);
    entry.requests += num(mx.api_requests);
    entry.successful += num(mx.successful_requests);
    // Per-model spend is nested under `.metrics.spend`; keys carry a provider prefix
    // (e.g. "vertex_ai/claude-opus-5") which we strip and merge for display.
    const models = r?.breakdown?.models ?? {};
    for (const [m, v] of Object.entries<any>(models)) {
      const name = m.includes('/') ? m.slice(m.lastIndexOf('/') + 1) : m;
      entry.byModel[name] = (entry.byModel[name] ?? 0) + num(v?.metrics?.spend);
    }
    byDate.set(date, entry);

    if (date >= monthStartYmd && date <= endYmd) {
      monthToDate += num(mx.spend);
      monthRequests += num(mx.api_requests);
      monthSuccessful += num(mx.successful_requests);
      monthFailed += num(mx.failed_requests);
      monthTokens.prompt += num(mx.prompt_tokens);
      monthTokens.completion += num(mx.completion_tokens);
      monthTokens.cacheRead += num(mx.cache_read_input_tokens);
      monthTokens.cacheCreate += num(mx.cache_creation_input_tokens);
    }
    if (date >= startYmd && date <= prevEndYmd) prevMonthToDate += num(mx.spend);
  }

  const data: LiteLlmBase = {
    byDate,
    today,
    monthLabel: `${MONTH_ABBR[monthStart.getMonth()]} ${monthStart.getFullYear()}`,
    monthToDate,
    monthRequests,
    monthSuccessful,
    monthFailed,
    monthTokens,
    prevMonthLabel: MONTH_ABBR[prevMonthStart.getMonth()],
    prevMonthToDate,
  };
  cachedLiteLlmBase = { key: cacheKey, data, fetchedAt: Date.now() };
  return data;
}

const ACCOUNT_TTL = 30 * 60 * 1000; // 30 min — lifetime spend moves slowly
let cachedLiteLlmAccount: { data: { user: number; key: number }; fetchedAt: number } | null = null;

/**
 * Lifetime spend from the self-scoped /user/info (the user, across all their keys)
 * and /key/info (this key). Degrades to zeros on any error — never throws, so it
 * can't break the spend response.
 */
async function fetchLiteLlmAccount(): Promise<{ user: number; key: number }> {
  if (cachedLiteLlmAccount && Date.now() - cachedLiteLlmAccount.fetchedAt < ACCOUNT_TTL) return cachedLiteLlmAccount.data;
  const base = litellmBaseUrl();
  const token = litellmAuthToken();
  if (!base || !token) return { user: 0, key: 0 };
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const get = async (path: string): Promise<any> => {
    try {
      const r = await fetch(`${base}${path}`, { headers, signal: AbortSignal.timeout(15_000) });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  const [u, k] = await Promise.all([get('/user/info'), get('/key/info')]);
  const data = {
    user: num(u?.user_info?.spend ?? u?.spend),
    key: num(k?.info?.spend ?? k?.spend),
  };
  cachedLiteLlmAccount = { data, fetchedAt: Date.now() };
  return data;
}

/** Actual billed spend: month-to-date, previous-month same-period total, and the
 *  last `days` calendar days (incl. today, zero-filled) with per-model breakdown. */
export async function fetchLiteLlmSpend(days: number): Promise<LiteLlmSpend> {
  const b = await fetchLiteLlmBase();
  const lifetime = await fetchLiteLlmAccount();
  const daily: LiteLlmSpend['daily'] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ymd = localYmd(new Date(b.today.getFullYear(), b.today.getMonth(), b.today.getDate() - i));
    const e = b.byDate.get(ymd);
    daily.push({ date: ymd, cost: e?.cost ?? 0, requests: e?.requests ?? 0, successful: e?.successful ?? 0, byModel: e?.byModel ?? {} });
  }
  return {
    monthLabel: b.monthLabel,
    monthToDate: b.monthToDate,
    monthRequests: b.monthRequests,
    monthSuccessful: b.monthSuccessful,
    monthFailed: b.monthFailed,
    monthTokens: b.monthTokens,
    prevMonthLabel: b.prevMonthLabel,
    prevMonthToDate: b.prevMonthToDate,
    lifetime,
    daily,
  };
}

