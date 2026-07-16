/**
 * auto-resume.ts — resume interrupted Claude Code work after a usage-limit reset.
 *
 * The backend watches the live OAuth usage numbers while the feature is armed.
 * When the 5-hour (or, opt-in, weekly) limit is exhausted it captures every
 * recently-active Claude Code session (up to MAX_SESSIONS — a limit hit blocks
 * ALL of them, not just one) and schedules a ResumeJob per session for ~1 min
 * after the limit's resets_at. Execution happens on the HOST: either the
 * companion watcher script (scripts/resume-watcher.mjs) polling
 * /api/auto-resume/pending, or — when the backend itself runs on the host with
 * the CLI available and no watcher is alive — an internal spawn of
 * `claude -p --resume <sessionId>`.
 *
 * All state is in-memory (the Docker mount is read-only). Durability comes from
 * the frontend re-POSTing its localStorage prefs when `configured` is false,
 * and from jobs being derived state: while the limit is still exhausted lost
 * jobs are recreated idempotently (id = `${windowKind}:${resetsAtMs}:${sessionId}`).
 */

import { spawn } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { open, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import { basename, join } from 'node:path';
import { claudeDir, fetchLiveUsage } from './scan.ts';
import { getLiveSubagents } from './subagents-live.ts';
import { getInsights } from './insights-scan.ts';
import { claudeCliAvailable } from './ai.ts';
import { isDocker } from './version.ts';

export type AutoResumeMode = 'off' | 'once' | 'always';
export type AutoResumePermission = 'inherit' | 'plan' | 'acceptEdits' | 'auto' | 'bypassPermissions';

const PERMISSIONS: AutoResumePermission[] = ['inherit', 'plan', 'acceptEdits', 'auto', 'bypassPermissions'];
export type ResumeJobStatus = 'pending' | 'claimed' | 'done' | 'failed' | 'skipped' | 'cancelled';
export type ResumeWindowKind = 'session' | 'weekly';

export interface ResumeJob {
  /** `${windowKind}:${resetsAtMs}:${sessionId}` — idempotency key per window+session. */
  id: string;
  windowKind: ResumeWindowKind;
  sessionId: string;
  /** Real cwd read from the session JSONL tail (decoded dir names are lossy). */
  projectPath: string;
  /** Backend-view absolute JSONL path, for mtime "already continued" checks. */
  sessionFile: string;
  prompt: string;
  permission: AutoResumePermission;
  /** Tool rules auto-approved for the headless run (delivered via a temp --settings file). */
  allowedTools: string[];
  resetsAt: number;
  resumeAt: number;
  createdAt: number;
  status: ResumeJobStatus;
  claimedAt: number | null;
  claimedBy: string | null;
  finishedAt: number | null;
  exitCode: number | null;
  message: string | null;
}

interface LimitSnapshot {
  utilization: number | null;
  resetsAt: string | null;
  checkedAt: number;
}

export interface AutoResumeState {
  configured: boolean;
  mode: AutoResumeMode;
  prompt: string;
  armed: boolean;
  triggerWeekly: boolean;
  permission: AutoResumePermission;
  allowedTools: string[];
  limit: LimitSnapshot | null;
  weeklyLimit: LimitSnapshot | null;
  /** Active (pending/claimed) jobs — one per interrupted session, soonest resumeAt first. */
  jobs: ResumeJob[];
  /** Terminal jobs, newest first (capped). */
  history: ResumeJob[];
  watcher: { online: boolean; lastSeenAt: number | null; id: string | null };
  internalExecutor: boolean;
  /**
   * HOST path of this repo, for rendering a runnable watcher command in the UI.
   * Host/dev mode: process.cwd(). Docker: HOST_REPO_DIR from .env (the container
   * can't discover the host path itself) — null when unset.
   */
  repoDir: string | null;
  /**
   * Is bypassPermissions usable in this user's Claude Code config? true =
   * accepted/enabled, false = not enabled (or disabled by policy), null =
   * can't determine (~/.claude.json not readable — e.g. Docker without the mount).
   */
  bypassAvailable: boolean | null;
  serverNow: number;
}

export const DEFAULT_RESUME_PROMPT =
  'You were interrupted by a usage limit. Continue exactly where you left off and finish the task in progress.';

const POLL_MS = Number(process.env.AUTO_RESUME_POLL_MS ?? 45_000);
const THRESHOLD = Number(process.env.AUTO_RESUME_THRESHOLD ?? 100);
const DELAY_MS = Number(process.env.AUTO_RESUME_DELAY_MS ?? 60_000);
/** Testing: when set, resumeAt = now + this instead of resets_at-based. */
const FORCE_DELAY_MS = process.env.AUTO_RESUME_FORCE_DELAY_MS
  ? Number(process.env.AUTO_RESUME_FORCE_DELAY_MS)
  : null;
const WATCHER_ONLINE_MS = Number(process.env.AUTO_RESUME_WATCHER_ONLINE_MS ?? 90_000);
/** A claimed job whose executor never reports back is failed after this long. */
const CLAIM_TIMEOUT_MS = Number(process.env.AUTO_RESUME_CLAIM_TIMEOUT_MS ?? 60 * 60_000);
/** Max interrupted sessions resumed per limit hit. */
const MAX_SESSIONS = Number(process.env.AUTO_RESUME_MAX_SESSIONS ?? 5);
const MAX_PROMPT_LEN = 2000;
const HISTORY_CAP = 20;
const TAIL_BYTES = 256 * 1024;

// ── Module state ─────────────────────────────────────────────────────────────

let configured = false;
let mode: AutoResumeMode = 'off';
let prompt = DEFAULT_RESUME_PROMPT;
let triggerWeekly = false;
let permission: AutoResumePermission = 'inherit';
let allowedTools: string[] = [];
let sessionSnapshot: LimitSnapshot | null = null;
let weeklySnapshot: LimitSnapshot | null = null;
let jobs: ResumeJob[] = []; // active only (pending/claimed)
let history: ResumeJob[] = []; // terminal, newest first
let watcherId: string | null = null;
let watcherLastSeen: number | null = null;
let ticker: NodeJS.Timeout | null = null;
let ticking = false;
let internalRunning = false;

function watcherOnline(): boolean {
  return watcherLastSeen != null && Date.now() - watcherLastSeen < WATCHER_ONLINE_MS;
}

async function internalExecutorAvailable(): Promise<boolean> {
  return !isDocker() && (await claudeCliAvailable());
}

// ── Bypass availability ──────────────────────────────────────────────────────
// `--permission-mode bypassPermissions` only works if the user enabled it in
// Claude Code: either the one-time acceptance flag in ~/.claude.json
// (bypassPermissionsModeAccepted) or permissions.defaultMode in settings.json —
// and never when policy sets permissions.disableBypassPermissionsMode='disable'.
// In Docker, ~/.claude.json is reachable via the optional CLAUDE_JSON mount.

let bypassCache: { value: boolean | null; at: number } | null = null;

async function bypassAvailable(): Promise<boolean | null> {
  if (bypassCache && Date.now() - bypassCache.at < 60_000) return bypassCache.value;
  let value: boolean | null = null;
  try {
    const settings = JSON.parse(await readFile(join(claudeDir(), 'settings.json'), 'utf8'));
    const perms = settings?.permissions;
    if (perms?.disableBypassPermissionsMode === 'disable') value = false;
    else if (perms?.defaultMode === 'bypassPermissions') value = true;
  } catch {
    /* no settings.json — fall through */
  }
  if (value === null) {
    const candidates = [process.env.CLAUDE_JSON || '', join(os.homedir(), '.claude.json')].filter(Boolean);
    for (const p of candidates) {
      try {
        const st = await stat(p);
        if (!st.isFile()) continue; // Docker fallback mounts a dir here when CLAUDE_JSON_HOST is unset
        const cj = JSON.parse(await readFile(p, 'utf8'));
        value = cj?.bypassPermissionsModeAccepted === true;
        break;
      } catch {
        /* try next candidate */
      }
    }
  }
  bypassCache = { value, at: Date.now() };
  return value;
}

export async function getState(): Promise<AutoResumeState> {
  return {
    configured,
    mode,
    prompt,
    armed: mode !== 'off',
    triggerWeekly,
    permission,
    allowedTools,
    limit: sessionSnapshot,
    weeklyLimit: triggerWeekly ? weeklySnapshot : null,
    jobs: [...jobs].sort((a, b) => a.resumeAt - b.resumeAt),
    history,
    watcher: { online: watcherOnline(), lastSeenAt: watcherLastSeen, id: watcherId },
    internalExecutor: await internalExecutorAvailable(),
    repoDir: isDocker() ? (process.env.HOST_REPO_DIR || '').trim() || null : process.cwd(),
    bypassAvailable: await bypassAvailable(),
    serverNow: Date.now(),
  };
}

export interface ClientPrefs {
  mode: AutoResumeMode;
  prompt: string;
  triggerWeekly: boolean;
  permission: AutoResumePermission;
  allowedTools: string[];
}

/**
 * Split a legacy space-joined rule string into whole rules, paren-aware:
 * `Edit Bash(npm run:*) Write` → ['Edit', 'Bash(npm run:*)', 'Write'].
 * Spaces inside (...) belong to the rule; best-effort for legacy payloads only —
 * new clients send arrays with exact boundaries.
 */
export function tokenizeRules(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function validPrefs(body: any): ClientPrefs | null {
  const m = body?.mode;
  if (m !== 'off' && m !== 'once' && m !== 'always') return null;
  const p = body?.permission ?? 'inherit';
  if (!PERMISSIONS.includes(p)) return null;
  const raw = String(body?.prompt ?? '').slice(0, MAX_PROMPT_LEN).trim();
  // Tool grants arrive as an ARRAY of whole rules (the client knows the exact
  // boundaries). Rules may contain any characters — quotes, pipes, spaces — and
  // are NEVER placed on a command line; executors deliver them via a temp
  // --settings JSON file. Legacy string payloads are tokenized paren-aware.
  const rawTools = body?.allowedTools;
  const list: string[] = Array.isArray(rawTools)
    ? rawTools.map((r: unknown) => String(r))
    : tokenizeRules(String(rawTools ?? ''));
  const tools = list.map((r) => r.trim()).filter(Boolean).map((r) => r.slice(0, 500)).slice(0, 200);
  return { mode: m, prompt: raw || DEFAULT_RESUME_PROMPT, triggerWeekly: !!body?.triggerWeekly, permission: p, allowedTools: tools };
}

export async function setStateFromClient(prefs: ClientPrefs): Promise<AutoResumeState> {
  configured = true;
  mode = prefs.mode;
  prompt = prefs.prompt;
  triggerWeekly = prefs.triggerWeekly;
  permission = prefs.permission;
  allowedTools = prefs.allowedTools;
  savePrefsToDisk();
  if (mode === 'off') {
    for (const j of jobs.filter((j) => j.status === 'pending')) {
      finishJob(j, 'cancelled', { message: 'auto-resume disarmed' });
    }
  }
  syncTicker();
  return getState();
}

// ── Prefs persistence ────────────────────────────────────────────────────────
// ~/.claude alone is read-only in Docker, but the container's HOME is writable —
// persisting there lets the backend re-arm itself after a restart WITHOUT a
// dashboard tab being open. Survives container restarts; a full image rebuild
// wipes it, in which case the next opened tab re-POSTs its localStorage prefs.

const PREFS_FILE = join(os.homedir(), '.claude-dashboard-auto-resume.json');

function savePrefsToDisk(): void {
  try {
    writeFileSync(PREFS_FILE, JSON.stringify({ mode, prompt, triggerWeekly, permission, allowedTools }));
  } catch {
    /* best-effort — in-memory + localStorage still cover it */
  }
}

function loadPrefsFromDisk(): void {
  try {
    const p = validPrefs(JSON.parse(readFileSync(PREFS_FILE, 'utf8')));
    if (!p) return;
    mode = p.mode;
    prompt = p.prompt;
    triggerWeekly = p.triggerWeekly;
    permission = p.permission;
    allowedTools = p.allowedTools;
    configured = true;
    syncTicker();
  } catch {
    /* no saved prefs — stay unconfigured until the frontend POSTs */
  }
}

loadPrefsFromDisk();

export function getPendingJobs(id: string | undefined): { jobs: ResumeJob[]; serverNow: number } {
  if (id) {
    watcherId = id;
    watcherLastSeen = Date.now();
  }
  return { jobs: jobs.filter((j) => j.status === 'pending'), serverNow: Date.now() };
}

export type ClaimResult =
  | { ok: true; job: ResumeJob }
  | { ok: false; code: 404 | 409 | 410; reason: string };

export async function claimJob(id: string, claimedBy: string): Promise<ClaimResult> {
  const j = jobs.find((x) => x.id === id);
  if (!j) return { ok: false, code: 404, reason: 'unknown job' };
  if (j.status !== 'pending') return { ok: false, code: 409, reason: `job is ${j.status}` };

  // Session already continued (user came back and kept working)?
  try {
    const st = await stat(j.sessionFile);
    if (st.mtimeMs > j.createdAt + 60_000) {
      const skipped = finishJob(j, 'skipped', { message: 'session was resumed manually before the scheduled time' });
      return { ok: false, code: 410, reason: skipped.message! };
    }
  } catch {
    // File unreadable — proceed; the CLI locates the session by id anyway.
  }

  // Best-effort: has the limit actually reset? A claim must not go through while
  // the window is still exhausted and counting down (executing then would fail
  // instantly). Never block the claim on network failure.
  if (!j.id.startsWith('test:')) {
    try {
      const usage = await fetchLiveUsage();
      const w = extractWindow(usage, j.windowKind);
      if (
        w && w.utilization != null && w.utilization >= THRESHOLD &&
        w.resetsAtMs && w.resetsAtMs > Date.now() + 30_000
      ) {
        // Reschedule EVERY sibling of this window — they all wait on the same reset.
        for (const sib of jobs.filter((x) => x.status === 'pending' && x.windowKind === j.windowKind)) {
          sib.resetsAt = w.resetsAtMs;
          sib.resumeAt = w.resetsAtMs + DELAY_MS;
        }
        return { ok: false, code: 409, reason: 'limit not reset yet — jobs rescheduled' };
      }
    } catch {
      /* offline check is best-effort */
    }
  }

  j.status = 'claimed';
  j.claimedAt = Date.now();
  j.claimedBy = claimedBy || 'unknown';
  return { ok: true, job: j };
}

export function completeJob(
  id: string,
  r: { ok: boolean; exitCode?: number; message?: string },
): ResumeJob | null {
  const j = jobs.find((x) => x.id === id);
  if (!j) return null;
  return finishJob(j, r.ok ? 'done' : 'failed', {
    exitCode: typeof r.exitCode === 'number' ? r.exitCode : null,
    message: String(r.message ?? '').slice(0, 4000) || null,
  });
}

/** Testing/dev: schedule a real resume of the most recent session, bypassing limit detection. */
export async function createTestJob(delayMs: number): Promise<ResumeJob> {
  const targets = await captureTargetSessions(1, Date.now() - 5 * 3600_000);
  const target = targets[0];
  if (!target) throw new Error('no recent Claude Code session found to resume');
  for (const j of jobs.filter((x) => x.status === 'pending' && x.id.startsWith('test:'))) {
    finishJob(j, 'cancelled', { message: 'replaced by newer test job' });
  }
  const now = Date.now();
  const j: ResumeJob = {
    id: `test:${now + delayMs}:${target.sessionId}`,
    windowKind: 'session',
    sessionId: target.sessionId,
    projectPath: target.projectPath,
    sessionFile: target.sessionFile,
    prompt,
    permission,
    allowedTools,
    resetsAt: now,
    resumeAt: now + delayMs,
    createdAt: now,
    status: 'pending',
    claimedAt: null,
    claimedBy: null,
    finishedAt: null,
    exitCode: null,
    message: target.pathWarning ? `cwd fallback: ${target.pathWarning}` : null,
  };
  jobs.push(j);
  syncTicker();
  return j;
}

// ── Job lifecycle helpers ────────────────────────────────────────────────────

function finishJob(
  j: ResumeJob,
  status: 'done' | 'failed' | 'skipped' | 'cancelled',
  extra: { exitCode?: number | null; message?: string | null } = {},
): ResumeJob {
  j.status = status;
  j.finishedAt = Date.now();
  if (extra.exitCode !== undefined) j.exitCode = extra.exitCode;
  if (extra.message !== undefined) j.message = extra.message;
  jobs = jobs.filter((x) => x.id !== j.id);
  history = [j, ...history].slice(0, HISTORY_CAP);
  // 'once' fires a single scheduled batch: disarm when the batch is fully
  // drained and at least this job actually fired (cancellations don't consume).
  // Persist the disarm — otherwise a restart re-arms from the stale prefs file.
  if (mode === 'once' && status !== 'cancelled' && jobs.length === 0) {
    mode = 'off';
    savePrefsToDisk();
  }
  syncTicker();
  return j;
}

// ── Live-usage window extraction ─────────────────────────────────────────────

interface WindowNumbers {
  utilization: number | null;
  resetsAt: string | null;
  resetsAtMs: number | null;
}

function extractWindow(usage: any, kind: ResumeWindowKind): WindowNumbers | null {
  if (!usage || usage.error) return null;
  let utilization: number | null = null;
  let resetsAt: string | null = null;
  const limits: any[] = Array.isArray(usage.limits) ? usage.limits : [];
  const scoped = kind === 'session'
    ? limits.find((l) => l?.group === 'session')
    : limits.find((l) => l?.kind === 'weekly_all');
  if (scoped) {
    utilization = typeof scoped.percent === 'number' ? scoped.percent : null;
    resetsAt = typeof scoped.resets_at === 'string' ? scoped.resets_at : null;
  } else {
    const legacy = kind === 'session' ? usage.five_hour : usage.seven_day;
    if (!legacy) return null;
    utilization = typeof legacy.utilization === 'number' ? legacy.utilization : null;
    resetsAt = typeof legacy.resets_at === 'string' ? legacy.resets_at : null;
  }
  const ms = resetsAt ? Date.parse(resetsAt) : NaN;
  return { utilization, resetsAt, resetsAtMs: Number.isFinite(ms) ? ms : null };
}

// ── Target-session capture ───────────────────────────────────────────────────

interface TargetSession {
  sessionId: string;
  projectPath: string;
  sessionFile: string;
  pathWarning?: string;
}

/**
 * Real Claude Code session ids are UUIDs. Anything else in the projects tree —
 * `agent-<id>.jsonl` subagent transcripts, metadata — is NOT resumable:
 * `claude --resume agent-…` fails with "requires a valid session ID".
 */
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isResumableSessionFile(file: string): boolean {
  return SESSION_ID_RE.test(basename(file, '.jsonl'));
}

/**
 * The sessions interrupted by a limit hit = sessions with activity inside the
 * exhausted limit window (they're the ones that consumed it), newest first.
 * Anchored to `sinceMs` — NOT "modified in the last N minutes": a blocked
 * session stops writing immediately, so by the time jobs are (re)derived its
 * mtime looks stale while unrelated work (another project, this dashboard's own
 * session) looks fresh. That mis-capture is exactly what a wall-clock window
 * causes. Only real session UUID files qualify — never agent-*.jsonl files.
 */
async function captureTargetSessions(max: number, sinceMs: number): Promise<TargetSession[]> {
  const candidates: { file: string; lastTs: number }[] = [];
  try {
    const { insights } = await getInsights();
    for (const sm of insights.sessionsMeta.values()) {
      if (sm.source !== 'code' || sm.isSidechain || sm.agentId) continue;
      if (!isResumableSessionFile(sm.file)) continue;
      if (sm.lastTs < sinceMs) continue;
      candidates.push({ file: sm.file, lastTs: sm.lastTs });
    }
  } catch {
    /* fall through to the live fallback below */
  }
  // Fallback (insights unavailable/empty): live main agents by mtime window.
  if (!candidates.length) {
    try {
      const live = await getLiveSubagents();
      for (const agent of live.mainAgents.filter((a) => isResumableSessionFile(a.key))) {
        candidates.push({ file: agent.key, lastTs: agent.lastActivity });
      }
    } catch {
      /* nothing found */
    }
  }
  candidates.sort((a, b) => b.lastTs - a.lastTs);
  const files: string[] = [];
  for (const c of candidates) {
    if (!files.includes(c.file)) files.push(c.file);
    if (files.length >= max) break;
  }

  const targets: TargetSession[] = [];
  for (const sessionFile of files) {
    const sessionId = basename(sessionFile, '.jsonl');
    const cwd = await readSessionCwd(sessionFile);
    targets.push(
      cwd
        ? { sessionId, projectPath: cwd, sessionFile }
        : {
            sessionId,
            projectPath: '',
            sessionFile,
            pathWarning: 'could not read cwd from session JSONL; executor will spawn without cwd',
          },
    );
  }
  return targets;
}

/** Read the last `cwd` recorded in a session JSONL (tail read; real host path). */
export async function readSessionCwd(file: string): Promise<string | null> {
  try {
    const st = await stat(file);
    const start = Math.max(0, st.size - TAIL_BYTES);
    const fh = await open(file, 'r');
    try {
      const buf = Buffer.alloc(Math.min(TAIL_BYTES, st.size));
      await fh.read(buf, 0, buf.length, start);
      const lines = buf.toString('utf8').split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const obj = JSON.parse(line);
          if (typeof obj?.cwd === 'string' && obj.cwd) return obj.cwd;
        } catch {
          /* partial first line of the tail window, or junk */
        }
      }
    } finally {
      await fh.close();
    }
  } catch {
    /* unreadable */
  }
  return null;
}

// ── Watcher tick ─────────────────────────────────────────────────────────────

function syncTicker(): void {
  const needed = mode !== 'off' || jobs.length > 0;
  if (needed && !ticker) {
    ticker = setInterval(() => void evaluateTick(), POLL_MS);
    void evaluateTick();
  } else if (!needed && ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

async function evaluateTick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    if (mode !== 'off') {
      await detectLimitHit();
    } else {
      // Invariant: no scheduled jobs while disarmed. Covers the race where a
      // disarm POST lands mid-tick and the tick still appends a job after the
      // POST's cancellation pass ran (test jobs are exempt — explicit user action).
      for (const j of jobs.filter((x) => x.status === 'pending' && !x.id.startsWith('test:'))) {
        finishJob(j, 'cancelled', { message: 'auto-resume disarmed' });
      }
    }
    // Stale-claim watchdog: an executor that died mid-resume leaves the job
    // 'claimed' forever, which would also block re-derivation for that session.
    for (const j of jobs.filter((x) => x.status === 'claimed' && x.claimedAt != null)) {
      if (Date.now() - j.claimedAt! > CLAIM_TIMEOUT_MS) {
        finishJob(j, 'failed', { message: `executor (${j.claimedBy}) never reported back` });
      }
    }
    await maybeExecuteInternally();
  } finally {
    ticking = false;
  }
}

async function detectLimitHit(): Promise<void> {
  let usage: any;
  try {
    usage = await fetchLiveUsage();
  } catch {
    return; // keep last snapshots
  }
  const now = Date.now();
  const session = extractWindow(usage, 'session');
  if (session) sessionSnapshot = { utilization: session.utilization, resetsAt: session.resetsAt, checkedAt: now };
  let weekly: WindowNumbers | null = null;
  if (triggerWeekly) {
    weekly = extractWindow(usage, 'weekly');
    if (weekly) weeklySnapshot = { utilization: weekly.utilization, resetsAt: weekly.resetsAt, checkedAt: now };
  }

  // Cancel pending jobs whose window un-hit itself well before the reset
  // (extra-usage credits kicked in, or the API recanted).
  for (const j of jobs.filter((x) => x.status === 'pending' && !x.id.startsWith('test:'))) {
    const w = j.windowKind === 'session' ? session : weekly;
    if (w && w.utilization != null && w.utilization < THRESHOLD - 5 && now < j.resetsAt - 120_000) {
      finishJob(j, 'cancelled', { message: 'limit no longer exhausted before reset' });
    }
  }

  // Which armed windows are exhausted with a known future reset?
  const candidates: Array<{ kind: ResumeWindowKind; resetsAtMs: number }> = [];
  if (session && session.utilization != null && session.utilization >= THRESHOLD && session.resetsAtMs && session.resetsAtMs > now) {
    candidates.push({ kind: 'session', resetsAtMs: session.resetsAtMs });
  }
  if (weekly && weekly.utilization != null && weekly.utilization >= THRESHOLD && weekly.resetsAtMs && weekly.resetsAtMs > now) {
    candidates.push({ kind: 'weekly', resetsAtMs: weekly.resetsAtMs });
  }
  if (!candidates.length) return;

  // Both windows exhausted → resume only after the LATER reset (resuming after
  // the earlier one would immediately hit the other wall).
  const pick = candidates.reduce((a, b) => (b.resetsAtMs > a.resetsAtMs ? b : a));
  for (const j of jobs.filter((x) => x.status === 'pending' && x.windowKind !== pick.kind && !x.id.startsWith('test:'))) {
    if (pick.resetsAtMs > j.resetsAt) {
      finishJob(j, 'cancelled', { message: `superseded by ${pick.kind} limit resetting later` });
    }
  }

  // One job per interrupted session — a limit hit blocks all of them. The
  // interrupted set = sessions active inside the exhausted window (for the 5h
  // window: since its start at resets_at − 5h; for weekly: the last 5h of work).
  const sinceMs = pick.kind === 'session' ? pick.resetsAtMs - 5 * 3600_000 : Date.now() - 5 * 3600_000;
  const targets = await captureTargetSessions(MAX_SESSIONS, sinceMs);
  if (!targets.length) return; // UI shows "armed, no session found" via snapshots + empty jobs

  for (const target of targets) {
    // resets_at can drift between ticks — same session must never get a second
    // job. An existing active job for (window, session) is updated in place.
    const existing = jobs.find(
      (x) => x.windowKind === pick.kind && x.sessionId === target.sessionId && !x.id.startsWith('test:'),
    );
    if (existing) {
      if (existing.status === 'pending' && pick.resetsAtMs > existing.resetsAt) {
        existing.resetsAt = pick.resetsAtMs;
        existing.resumeAt = FORCE_DELAY_MS != null ? existing.resumeAt : pick.resetsAtMs + DELAY_MS;
      }
      continue;
    }
    const id = `${pick.kind}:${pick.resetsAtMs}:${target.sessionId}`;
    if (history.some((x) => x.id === id && x.status !== 'cancelled')) continue; // already handled this window
    const now2 = Date.now();
    jobs.push({
      id,
      windowKind: pick.kind,
      sessionId: target.sessionId,
      projectPath: target.projectPath,
      sessionFile: target.sessionFile,
      prompt,
      permission,
      allowedTools,
      resetsAt: pick.resetsAtMs,
      resumeAt: FORCE_DELAY_MS != null ? now2 + FORCE_DELAY_MS : pick.resetsAtMs + DELAY_MS,
      createdAt: now2,
      status: 'pending',
      claimedAt: null,
      claimedBy: null,
      finishedAt: null,
      exitCode: null,
      message: target.pathWarning ? `cwd fallback: ${target.pathWarning}` : null,
    });
  }
  syncTicker();
}

// ── Internal executor (host/dev mode only, watcher offline) ─────────────────

export function permissionArgs(perm: AutoResumePermission): string[] {
  // 'inherit' = no flag → the session's own mode. Everything else maps 1:1 to
  // the CLI's --permission-mode values (plan / acceptEdits / auto / bypassPermissions).
  return perm === 'inherit' ? [] : ['--permission-mode', perm];
}

async function maybeExecuteInternally(): Promise<void> {
  if (internalRunning) return;
  if (watcherOnline()) return; // watcher owns execution when alive
  const due = jobs.filter((j) => j.status === 'pending' && Date.now() >= j.resumeAt);
  if (!due.length) return;
  if (!(await internalExecutorAvailable())) return;

  internalRunning = true;
  try {
    // Sequential on purpose: right after a reset, N parallel resumes would race
    // each other into the fresh window.
    for (const j of due) {
      const claim = await claimJob(j.id, 'internal');
      if (!claim.ok) continue;
      try {
        const result = await spawnResume(claim.job);
        completeJob(claim.job.id, result);
      } catch (e: any) {
        completeJob(claim.job.id, { ok: false, message: String(e?.message ?? e) });
      }
    }
  } finally {
    internalRunning = false;
  }
}

/**
 * Tool grants travel via a temp `--settings` JSON file, NEVER as command-line
 * text: on Windows the spawn goes through `cmd /c`, which re-parses the whole
 * line — a rule containing `|` or `"` (e.g. Bash(grep -r "a\|b" …)) breaks out
 * and cmd executes the fragment ("'…' is not recognized as an internal or
 * external command"). A temp file path contains no cmd metacharacters.
 */
function writeGrantsFile(rules: string[]): string {
  const file = join(os.tmpdir(), `claude-resume-grants-${process.pid}-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify({ permissions: { allow: rules } }));
  return file;
}

/** Spawn `claude -p --resume <sessionId>` with the prompt on stdin. Mirrors ai.ts cliInvocation(). */
function spawnResume(j: ResumeJob): Promise<{ ok: boolean; exitCode?: number; message?: string }> {
  return new Promise((resolve) => {
    const cliArgs = ['-p', '--resume', j.sessionId, ...permissionArgs(j.permission)];
    let grantsFile: string | null = null;
    if (j.allowedTools.length) {
      try {
        grantsFile = writeGrantsFile(j.allowedTools);
        cliArgs.push('--settings', grantsFile);
      } catch {
        /* grants are an enhancement — resume without them beats not resuming */
      }
    }
    const file = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'claude';
    const args = process.platform === 'win32' ? ['/c', 'claude', ...cliArgs] : cliArgs;
    const opts: Parameters<typeof spawn>[2] = { windowsHide: true };
    if (j.projectPath) opts.cwd = j.projectPath;
    let child;
    try {
      child = spawn(file, args, opts);
    } catch (e: any) {
      if (grantsFile) {
        try {
          unlinkSync(grantsFile);
        } catch {
          /* already gone */
        }
      }
      resolve({ ok: false, message: `spawn failed: ${String(e?.message ?? e)}` });
      return;
    }
    let out = '';
    const cap = (chunk: Buffer) => {
      if (out.length < 64 * 1024) out += chunk.toString('utf8');
    };
    const cleanup = () => {
      if (grantsFile) {
        try {
          unlinkSync(grantsFile);
        } catch {
          /* already gone */
        }
        grantsFile = null;
      }
    };
    child.stdout?.on('data', cap);
    child.stderr?.on('data', cap);
    child.on('error', (e) => {
      cleanup();
      resolve({ ok: false, message: `spawn error: ${e.message}` });
    });
    child.on('close', (code) => {
      cleanup();
      resolve({ ok: code === 0, exitCode: code ?? -1, message: out.slice(-4000) });
    });
    child.stdin?.end(j.prompt);
  });
}
