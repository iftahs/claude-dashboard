import { createReadStream } from 'node:fs';
import { readdir, stat, readFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

export type UsageSource = 'code' | 'cowork';

export interface UsageEvent {
  ts: number; // epoch ms
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  tools: string[]; // tool_use names invoked in this assistant message
  projectPath: string; // decoded path of the project directory
  gitBranch: string; // git branch at the time of the message ('' if unknown)
  source: UsageSource; // 'code' = Claude Code CLI, 'cowork' = desktop local-agent mode
}

export function claudeDir(): string {
  return process.env.CLAUDE_DIR || join(homedir(), '.claude');
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
 * segment. Code files are always kept.
 */
export function keepScanFile(file: string, source: UsageSource): boolean {
  if (source === 'code') return true;
  return /[\\/]\.claude[\\/]projects[\\/]/.test(file);
}

async function listJsonl(dir: string, source: UsageSource = 'code'): Promise<string[]> {
  let entries: string[] = [];
  let dirents;
  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const d of dirents) {
    const full = join(dir, d.name);
    if (d.isDirectory()) {
      entries = entries.concat(await listJsonl(full, source));
    } else if (d.isFile() && d.name.endsWith('.jsonl') && keepScanFile(full, source)) {
      entries.push(full);
    }
  }
  return entries;
}

/** Newest mtime across all scanned jsonl files — a cheap cache-invalidation signal. */
export async function projectsFingerprint(): Promise<number> {
  const fileLists = await Promise.all(scanRoots().map((r) => listJsonl(r.dir, r.source)));
  const files = fileLists.flat();
  let newest = 0;
  await Promise.all(
    files.map(async (f) => {
      try {
        const s = await stat(f);
        if (s.mtimeMs > newest) newest = s.mtimeMs;
      } catch {
        /* ignore */
      }
    })
  );
  return newest;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

async function parseFile(
  file: string,
  seen: Map<string, number>,
  out: UsageEvent[],
  sessionPathMap?: Map<string, string>,
  source: UsageSource = 'code'
): Promise<void> {
  // Derive the OS path from the JSONL file path.
  // Claude encodes project dirs as: <drive-letter>--<path-segments-joined-by-->
  // e.g.  E--dev-projects-claude-dashboard  →  e:\dev-projects\claude-dashboard
  //       C--Users-Iftah-Saar-Desktop--Dev-Projects-my-landing-page-2026  →  c:\...
  // Rule: '--' is the OS path separator; single '-' stays as a literal dash.
  // Cowork transcripts encode a sandbox-internal path that is meaningless on the
  // host, so we leave projectPath empty for them (keeps them out of the Projects tab).
  let projectPath = '';
  if (source === 'cowork') {
    // skip decoding — sandbox path is not a real host project
  } else try {
    const parts = file.replace(/\\/g, '/').split('/');
    const projIdx = parts.lastIndexOf('projects');
    if (projIdx !== -1 && parts[projIdx + 1]) {
      const encoded = decodeURIComponent(parts[projIdx + 1]);
      // Detect Windows-style encoding: starts with a drive letter followed by '--'
      if (/^[A-Za-z]--/.test(encoded)) {
        // Replace '--' with '\' and prefix with drive letter
        const letter = encoded[0].toLowerCase();
        const rest = encoded.slice(3).replace(/--/g, '\\');
        projectPath = `${letter}:\\${rest}`;
      } else {
        // Unix-style: '--' → '/', single '-' stays
        projectPath = '/' + encoded.replace(/--/g, '/');
      }
    }
  } catch { /* keep empty */ }
  const rl = createInterface({
    input: createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line || line.length < 2) continue;
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj?.type !== 'assistant') continue;
    const usage = obj?.message?.usage;
    if (!usage) continue;

    const key = `${obj.requestId ?? ''}:${obj.message?.id ?? ''}`;

    const ts = Date.parse(obj.timestamp);
    if (Number.isNaN(ts)) continue;

    const tools: string[] = [];
    const content = obj.message?.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === 'tool_use' && typeof block.name === 'string') tools.push(block.name);
      }
    }

    const sessionId = obj.sessionId ?? obj.session_id ?? '';
    const resolvedProjectPath = (source === 'code' && sessionPathMap && sessionId)
      ? (sessionPathMap.get(sessionId) ?? projectPath)
      : projectPath;
    const gitBranch: string = typeof obj.gitBranch === 'string' ? obj.gitBranch : '';

    const event: UsageEvent = {
      ts,
      sessionId,
      model: obj.message?.model ?? 'unknown',
      inputTokens: num(usage.input_tokens),
      outputTokens: num(usage.output_tokens),
      cacheCreateTokens: num(usage.cache_creation_input_tokens),
      cacheReadTokens: num(usage.cache_read_input_tokens),
      tools,
      projectPath: resolvedProjectPath,
      gitBranch,
      source,
    };

    // Dedup: same logical response can appear multiple times (retries/streaming).
    // Early duplicates carry placeholder usage; keep whichever reports the most
    // effective tokens (input + output + cacheCreate), not the first seen.
    if (key !== ':') {
      const existingIdx = seen.get(key);
      if (existingIdx !== undefined) {
        const prev = out[existingIdx];
        const prevEff = prev.inputTokens + prev.outputTokens + prev.cacheCreateTokens;
        const nextEff = event.inputTokens + event.outputTokens + event.cacheCreateTokens;
        if (nextEff > prevEff) out[existingIdx] = event;
        continue;
      }
      seen.set(key, out.length);
    }

    out.push(event);
  }
}

/** Scan all session JSONL, dedup, return events sorted ascending by time. */
export async function scanEvents(): Promise<UsageEvent[]> {
  const sessions = await readSessionMetas();
  const sessionPathMap = new Map<string, string>();
  for (const s of sessions) {
    if (s?.session_id && s?.project_path) {
      sessionPathMap.set(s.session_id, s.project_path);
    }
  }

  // Shared dedup map across all roots: a session's cliSessionId can write to both
  // the global projects dir and a cowork root, and the requestId:message.id key
  // collapses those into one event regardless of which root it came from.
  const seen = new Map<string, number>();
  const out: UsageEvent[] = [];
  for (const root of scanRoots()) {
    const files = await listJsonl(root.dir, root.source);
    for (const f of files) {
      await parseFile(f, seen, out, sessionPathMap, root.source);
    }
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
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

export async function readCredentials(): Promise<any> {
  try {
    const filePath = join(claudeDir(), '.credentials.json');
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error('[server] failed to read .credentials.json:', e);
    return null;
  }
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

let cachedLiveUsage: {
  data: any;
  fetchedAt: number;
} | null = null;

let cachedLiveProfile: {
  data: any;
  fetchedAt: number;
} | null = null;

const CACHE_TTL = 30000; // 30 seconds local cache to avoid rate limit issues
const PROFILE_TTL = 30 * 60 * 1000; // 30 min — the plan changes rarely

/** Shared headers for Anthropic's OAuth endpoints (usage + profile + messages). */
export function oauthHeaders(accessToken: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'anthropic-beta': 'oauth-2025-04-20',
    'User-Agent': 'claude-code/2.1.162',
    'Accept': 'application/json',
  };
}

export async function fetchLiveUsage(): Promise<any> {
  if (cachedLiveUsage && (Date.now() - cachedLiveUsage.fetchedAt < CACHE_TTL)) {
    return cachedLiveUsage.data;
  }

  const credentials = await readCredentials();
  if (!credentials?.claudeAiOauth?.accessToken) {
    throw new Error('No access token found in credentials');
  }

  const expiresAt = credentials.claudeAiOauth.expiresAt;
  if (expiresAt && Date.now() >= expiresAt) {
    throw new Error('OAuth token expired — run any Claude Code command in your terminal to refresh it automatically.');
  }

  const url = 'https://api.anthropic.com/api/oauth/usage';
  const headers = oauthHeaders(credentials.claudeAiOauth.accessToken);

  const res = await fetch(url, { headers });
  if (res.status === 403) {
    throw new Error('OAuth token invalid (403). Please run any command in Claude CLI to refresh.');
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch live usage from Anthropic API: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  cachedLiveUsage = {
    data,
    fetchedAt: Date.now(),
  };
  return data;
}

/**
 * Live account/plan from Anthropic's OAuth profile endpoint. Returns the plan
 * the user is *actually* on right now — unlike the `subscriptionType` baked into
 * `.credentials.json`, which goes stale after a plan change until the next login.
 * Cached 30 min; throws (caller falls back to the local file) when offline/expired.
 */
export async function fetchLiveProfile(): Promise<any> {
  if (cachedLiveProfile && (Date.now() - cachedLiveProfile.fetchedAt < PROFILE_TTL)) {
    return cachedLiveProfile.data;
  }

  const credentials = await readCredentials();
  const accessToken = credentials?.claudeAiOauth?.accessToken;
  if (!accessToken) {
    throw new Error('No access token found in credentials');
  }

  const expiresAt = credentials.claudeAiOauth.expiresAt;
  if (expiresAt && Date.now() >= expiresAt) {
    throw new Error('OAuth token expired');
  }

  const res = await fetch('https://api.anthropic.com/api/oauth/profile', {
    headers: oauthHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch profile from Anthropic API: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  cachedLiveProfile = { data, fetchedAt: Date.now() };
  return data;
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
    // (e.g. "vertex_ai/claude-opus-4-8") which we strip and merge for display.
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

