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

