/**
 * workflows.ts
 * Live + recent "dynamic workflow" runs (the Workflow orchestration tool).
 *
 * On disk (code root only, under projects/<proj>/<session>/):
 *   workflows/wf_<runId>.json           – FINAL run summary, written ONCE at completion
 *   workflows/scripts/<name>-wf_<id>.js – generated orchestration script
 *   subagents/workflows/wf_<runId>/
 *     journal.jsonl                     – INCREMENTAL log: {type:started|result,key,agentId}
 *     agent-<agentId>.jsonl             – per-subagent transcript (isSidechain)
 *     agent-<agentId>.meta.json         – {"agentType":"workflow-subagent"}
 *
 * Because the final journal only appears at completion, a *running* workflow is a
 * run dir with no (or non-"completed") final journal AND fresh file mtimes — so
 * liveness is decided by mtime windows, mirroring subagents-live.ts. 3s TTL cache.
 */

import { createReadStream } from 'node:fs';
import { readdir, stat, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';
import { claudeDir } from './scan.ts';

// ── Public shapes (mirror src/types.ts) ──────────────────────────────────────

export type WorkflowAgentState = 'done' | 'running' | 'queued' | 'error' | 'stalled';

export interface WorkflowAgentInfo {
  agentId: string;
  label: string;
  phaseTitle: string;
  model: string;
  state: WorkflowAgentState;
  tokens: number;
  toolCalls: number;
  durationMs: number;
  startedAt: number;
  lastToolName?: string;
}

export interface WorkflowRun {
  runId: string;
  name: string;
  summary: string;
  status: 'running' | 'completed' | 'failed' | 'unknown';
  isLive: boolean;
  startedAt: number;
  durationMs: number;
  lastActivity: number;
  phaseDone: number | null;
  phaseTotal: number | null;
  phases: { title: string; detail: string }[];
  agents: WorkflowAgentInfo[];
  agentCount: number;
  runningAgents: number;
  tokens: number;
  toolCalls: number;
  defaultModel: string;
  project: string;
  resultStats?: Record<string, number | string>;
  logsTail?: string[];
}

export interface WorkflowsData {
  live: WorkflowRun[];
  recent: WorkflowRun[];
}

// ── Tunables ─────────────────────────────────────────────────────────────────

const LIVE_WINDOW = 90_000; // run touched in last 90s → live
const RECENT_WINDOW = 7 * 24 * 3_600_000; // completed runs surfaced for 7 days
const MAX_RECENT = 20;
const MAX_JOURNAL = 8 * 1024 * 1024; // skip absurd final journals (the `script` field is large)
const MAX_AGENT_FILE = 50 * 1024 * 1024;
const LIVE_AGENT_PARSE = 24; // parse at most N newest agent transcripts per live run
const RECENT_AGENT_CAP = 40; // cap agents emitted per recent run (payload hygiene)
const TTL = 3_000;

const ALLOWED_STATES = new Set<WorkflowAgentState>(['done', 'running', 'queued', 'error', 'stalled']);

// ── Helpers (shared with subagents-live.ts conventions) ──────────────────────

function projectsDir(): string {
  return join(claudeDir(), 'projects');
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function projectPathFromFile(file: string): string {
  try {
    const parts = file.replace(/\\/g, '/').split('/');
    const projIdx = parts.lastIndexOf('projects');
    if (projIdx !== -1 && parts[projIdx + 1]) {
      const encoded = decodeURIComponent(parts[projIdx + 1]);
      if (/^[A-Za-z]--/.test(encoded)) {
        const letter = encoded[0].toLowerCase();
        const rest = encoded.slice(3).replace(/--/g, '\\');
        return `${letter}:\\${rest}`;
      }
      return '/' + encoded.replace(/--/g, '/');
    }
  } catch {
    /* keep empty */
  }
  return '';
}

function projectNameFromPath(projectPath: string): string {
  return projectPath.split(/[\\/]/).filter(Boolean).pop() ?? projectPath;
}

function agentIdFromFileName(name: string): string | undefined {
  const m = name.match(/^agent-([a-z0-9]+)\.jsonl$/);
  return m ? m[1] : undefined;
}

function coerceState(s: unknown): WorkflowAgentState {
  return typeof s === 'string' && ALLOWED_STATES.has(s as WorkflowAgentState)
    ? (s as WorkflowAgentState)
    : 'done';
}

interface DiscoveredDir {
  runId: string;
  dir: string; // .../subagents/workflows/wf_<id>
  sessionDir: string; // .../<session>
}
interface DiscoveredJournal {
  runId: string;
  path: string; // .../workflows/wf_<id>.json
  mtime: number;
  size: number;
}

/**
 * Iterate projects/<proj>/<session>/ and collect final journals + run dirs.
 * Avoids walking transcripts/file-history — only reads the two relevant subtrees.
 */
async function discover(): Promise<{ dirs: DiscoveredDir[]; journals: DiscoveredJournal[] }> {
  const dirs: DiscoveredDir[] = [];
  const journals: DiscoveredJournal[] = [];
  const root = projectsDir();

  let projects: string[] = [];
  try {
    projects = (await readdir(root, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return { dirs, journals };
  }

  for (const proj of projects) {
    const projDir = join(root, proj);
    let sessions: string[] = [];
    try {
      sessions = (await readdir(projDir, { withFileTypes: true }))
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      continue;
    }
    for (const sess of sessions) {
      const sessionDir = join(projDir, sess);

      // Final journals: <session>/workflows/wf_*.json
      const wfDir = join(sessionDir, 'workflows');
      try {
        for (const f of await readdir(wfDir, { withFileTypes: true })) {
          if (!f.isFile() || !/^wf_.+\.json$/.test(f.name)) continue;
          const path = join(wfDir, f.name);
          try {
            const s = await stat(path);
            journals.push({ runId: f.name.replace(/\.json$/, ''), path, mtime: s.mtimeMs, size: s.size });
          } catch {
            /* skip */
          }
        }
      } catch {
        /* no workflows dir */
      }

      // Run dirs: <session>/subagents/workflows/wf_*/
      const runRoot = join(sessionDir, 'subagents', 'workflows');
      try {
        for (const d of await readdir(runRoot, { withFileTypes: true })) {
          if (!d.isDirectory() || !/^wf_/.test(d.name)) continue;
          dirs.push({ runId: d.name, dir: join(runRoot, d.name), sessionDir });
        }
      } catch {
        /* no run dirs */
      }
    }
  }
  return { dirs, journals };
}

interface DirProbe {
  dirMtime: number;
  journalMtime: number;
  newestAgentMtime: number;
  startedKeys: Set<string>;
  resultKeys: Set<string>;
  agentFiles: { agentId: string; path: string; mtime: number; size: number }[];
}

async function probeRunDir(dir: string): Promise<DirProbe> {
  const probe: DirProbe = {
    dirMtime: 0,
    journalMtime: 0,
    newestAgentMtime: 0,
    startedKeys: new Set(),
    resultKeys: new Set(),
    agentFiles: [],
  };
  try {
    probe.dirMtime = (await stat(dir)).mtimeMs;
  } catch {
    /* ignore */
  }

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return probe;
  }

  for (const e of entries) {
    if (!e.isFile()) continue;
    const full = join(dir, e.name);
    if (e.name === 'journal.jsonl') {
      try {
        probe.journalMtime = (await stat(full)).mtimeMs;
      } catch {
        /* ignore */
      }
      continue;
    }
    const agentId = agentIdFromFileName(e.name);
    if (agentId) {
      try {
        const s = await stat(full);
        probe.agentFiles.push({ agentId, path: full, mtime: s.mtimeMs, size: s.size });
        if (s.mtimeMs > probe.newestAgentMtime) probe.newestAgentMtime = s.mtimeMs;
      } catch {
        /* skip */
      }
    }
  }

  // Parse journal.jsonl for started/result keys (in-flight = started − result).
  const journalPath = join(dir, 'journal.jsonl');
  try {
    const s = await stat(journalPath);
    if (s.size <= 5 * 1024 * 1024) {
      const rl = createInterface({ input: createReadStream(journalPath, { encoding: 'utf8' }), crlfDelay: Infinity });
      for await (const line of rl) {
        if (!line || line.length < 2) continue;
        let obj: any;
        try {
          obj = JSON.parse(line);
        } catch {
          continue;
        }
        if (obj?.type === 'started' && typeof obj.key === 'string') probe.startedKeys.add(obj.key);
        else if (obj?.type === 'result' && typeof obj.key === 'string') probe.resultKeys.add(obj.key);
      }
    }
  } catch {
    /* no journal */
  }
  return probe;
}

interface AgentParse {
  effectiveTokens: number;
  model: string;
  firstTs: number;
  lastTs: number;
  firstUserText: string;
}

async function parseAgentFile(path: string): Promise<AgentParse> {
  const out: AgentParse = { effectiveTokens: 0, model: 'inherit', firstTs: Infinity, lastTs: 0, firstUserText: '' };
  try {
    const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line || line.length < 2) continue;
      let obj: any;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      const ts = Date.parse(obj.timestamp ?? '');
      if (!Number.isNaN(ts)) {
        if (ts < out.firstTs) out.firstTs = ts;
        if (ts > out.lastTs) out.lastTs = ts;
      }
      if (!out.firstUserText && obj.type === 'user' && obj.message) {
        const c = obj.message.content;
        if (typeof c === 'string') out.firstUserText = c.slice(0, 120);
        else if (Array.isArray(c)) {
          for (const b of c) {
            if (b?.type === 'text' && typeof b.text === 'string') {
              out.firstUserText = b.text.slice(0, 120);
              break;
            }
          }
        }
      }
      if (obj.type === 'assistant' && obj.message?.usage) {
        const u = obj.message.usage;
        out.effectiveTokens += num(u.input_tokens) + num(u.output_tokens) + num(u.cache_creation_input_tokens);
        if (obj.message.model && obj.message.model !== '<synthetic>') out.model = obj.message.model;
      }
    }
  } catch {
    /* unreadable */
  }
  if (out.firstTs === Infinity) out.firstTs = 0;
  return out;
}

function scriptNameForRun(sessionDir: string, runId: string): Promise<string | null> {
  const scriptsDir = join(sessionDir, 'workflows', 'scripts');
  return readdir(scriptsDir)
    .then((files) => {
      // Prefer the exact `-<runId>.js` suffix across all files before the loose
      // substring fallback, so runId `wf_12` can't match `…-wf_123.js`.
      const hit = files.find((f) => f.endsWith(`-${runId}.js`)) ?? files.find((f) => f.includes(runId));
      if (!hit) return null;
      return hit.replace(`-${runId}.js`, '').replace(/\.js$/, '');
    })
    .catch(() => null);
}

async function buildLiveRun(d: DiscoveredDir, probe: DirProbe): Promise<WorkflowRun> {
  const newest = Math.max(probe.dirMtime, probe.journalMtime, probe.newestAgentMtime);
  const project = projectNameFromPath(projectPathFromFile(d.dir));

  // Parse only the newest few agent transcripts to bound cost on 100-agent runs.
  const sorted = [...probe.agentFiles].sort((a, b) => b.mtime - a.mtime);
  const toParse = sorted.filter((f) => f.size <= MAX_AGENT_FILE).slice(0, LIVE_AGENT_PARSE);
  const parsed = await Promise.all(toParse.map((f) => parseAgentFile(f.path)));

  const agents: WorkflowAgentInfo[] = toParse.map((f, i) => {
    const p = parsed[i];
    const isFresh = Date.now() - f.mtime < LIVE_WINDOW;
    return {
      agentId: f.agentId,
      label: p.firstUserText || 'agent',
      phaseTitle: '',
      model: p.model,
      state: isFresh ? 'running' : 'stalled',
      tokens: p.effectiveTokens,
      toolCalls: 0, // not parsed for live agents (cost bound)
      durationMs: p.lastTs && p.firstTs ? Math.max(0, p.lastTs - p.firstTs) : 0,
      startedAt: p.firstTs || f.mtime,
    };
  });

  const agentCount = Math.max(probe.startedKeys.size, probe.agentFiles.length);
  const runningAgents = Math.max(0, probe.startedKeys.size - probe.resultKeys.size);
  const earliestStart = agents.reduce((min, a) => (a.startedAt > 0 ? Math.min(min, a.startedAt) : min), Infinity);
  const startedAt = earliestStart === Infinity ? probe.dirMtime : earliestStart;
  const tokens = agents.reduce((s, a) => s + a.tokens, 0);
  const name = (await scriptNameForRun(d.sessionDir, d.runId)) || '(workflow)';
  const defaultModel =
    agents.find((a) => a.model && a.model !== 'inherit' && a.model !== 'unknown')?.model ?? 'inherit';

  agents.sort((a, b) => b.tokens - a.tokens);

  return {
    runId: d.runId,
    name,
    summary: '',
    status: 'running',
    isLive: true,
    startedAt,
    durationMs: Math.max(0, Date.now() - startedAt),
    lastActivity: newest,
    phaseDone: null,
    phaseTotal: null,
    phases: [],
    agents,
    agentCount,
    runningAgents,
    tokens,
    toolCalls: 0, // not tracked incrementally for live runs
    defaultModel,
    project,
  };
}

function extractStats(result: any): Record<string, number | string> | undefined {
  const stats = result?.stats;
  if (!stats || typeof stats !== 'object') return undefined;
  const out: Record<string, number | string> = {};
  let n = 0;
  for (const [k, v] of Object.entries(stats)) {
    if (n >= 12) break;
    if (typeof v === 'number' || typeof v === 'string') {
      out[k] = v;
      n++;
    }
  }
  return n > 0 ? out : undefined;
}

async function parseFinalJournal(j: DiscoveredJournal): Promise<WorkflowRun | null> {
  const project = projectNameFromPath(projectPathFromFile(j.path));
  if (j.size > MAX_JOURNAL) {
    return {
      runId: j.runId,
      name: j.runId,
      summary: '',
      status: 'unknown',
      isLive: false,
      startedAt: j.mtime,
      durationMs: 0,
      lastActivity: j.mtime,
      phaseDone: null,
      phaseTotal: null,
      phases: [],
      agents: [],
      agentCount: 0,
      runningAgents: 0,
      tokens: 0,
      toolCalls: 0,
      defaultModel: 'inherit',
      project,
    };
  }

  let o: any;
  try {
    o = JSON.parse(await readFile(j.path, 'utf8'));
  } catch {
    return null;
  }
  delete o.script; // large, unused

  const wp: any[] = Array.isArray(o.workflowProgress) ? o.workflowProgress : [];
  const agentEntries = wp.filter((x) => x?.type === 'workflow_agent');
  const phaseIndexes = new Set<number>();
  for (const a of agentEntries) if (typeof a.phaseIndex === 'number') phaseIndexes.add(a.phaseIndex);

  const phaseTotal = Array.isArray(o.phases) ? o.phases.length : null;
  const status: WorkflowRun['status'] =
    o.status === 'completed' ? 'completed' : o.status ? 'failed' : 'unknown';

  const agents: WorkflowAgentInfo[] = agentEntries
    .slice()
    .sort((a, b) => num(b.tokens) - num(a.tokens))
    .slice(0, RECENT_AGENT_CAP)
    .map((a) => ({
      agentId: String(a.agentId ?? ''),
      label: String(a.label ?? 'agent').slice(0, 120),
      phaseTitle: String(a.phaseTitle ?? ''),
      model: String(a.model ?? 'inherit'),
      state: coerceState(a.state),
      tokens: num(a.tokens),
      toolCalls: num(a.toolCalls),
      durationMs: num(a.durationMs),
      startedAt: num(a.startedAt),
      lastToolName: typeof a.lastToolName === 'string' ? a.lastToolName : undefined,
    }));

  const tokens =
    num(o.totalTokens) > 0 ? num(o.totalTokens) : agentEntries.reduce((s, a) => s + num(a.tokens), 0);
  const lastActivity = Date.parse(o.timestamp) || j.mtime;
  const logs: string[] = Array.isArray(o.logs) ? o.logs.filter((l: any) => typeof l === 'string') : [];

  return {
    runId: String(o.runId ?? j.runId),
    name: String(o.workflowName || basename(o.scriptPath || '').replace(`-${j.runId}.js`, '') || j.runId),
    summary: String(o.summary ?? ''),
    status,
    isLive: false,
    startedAt: num(o.startTime) || lastActivity,
    durationMs: num(o.durationMs),
    lastActivity,
    phaseDone: phaseTotal != null ? Math.min(phaseTotal, phaseIndexes.size || phaseTotal) : null,
    phaseTotal,
    phases: Array.isArray(o.phases)
      ? o.phases.map((p: any) => ({ title: String(p?.title ?? ''), detail: String(p?.detail ?? '') }))
      : [],
    agents,
    agentCount: num(o.agentCount) || agentEntries.length,
    runningAgents: 0,
    tokens,
    toolCalls: num(o.totalToolCalls) || agentEntries.reduce((s, a) => s + num(a.toolCalls), 0),
    defaultModel: String(o.defaultModel || 'inherit'),
    project,
    resultStats: extractStats(o.result),
    logsTail: logs.slice(-8),
  };
}

// ── Compute + cache ──────────────────────────────────────────────────────────

async function computeWorkflows(): Promise<WorkflowsData> {
  const now = Date.now();
  const { dirs, journals } = await discover();
  const journalByRunId = new Map(journals.map((j) => [j.runId, j]));

  const live: WorkflowRun[] = [];
  const recentByRunId = new Map<string, WorkflowRun>();
  const liveRunIds = new Set<string>();

  for (const d of dirs) {
    const probe = await probeRunDir(d.dir);
    const final = journalByRunId.get(d.runId);
    const newest = Math.max(probe.dirMtime, probe.journalMtime, probe.newestAgentMtime);
    const isLive = now - newest < LIVE_WINDOW && (!final || (await peekStatus(final)) !== 'completed');
    if (isLive) {
      live.push(await buildLiveRun(d, probe));
      liveRunIds.add(d.runId);
    } else if (final) {
      const run = await parseFinalJournal(final);
      if (run) recentByRunId.set(d.runId, run);
    }
  }

  for (const j of journals) {
    if (liveRunIds.has(j.runId) || recentByRunId.has(j.runId)) continue;
    const run = await parseFinalJournal(j);
    if (run) recentByRunId.set(j.runId, run);
  }

  const recent = [...recentByRunId.values()]
    .filter((r) => now - r.lastActivity < RECENT_WINDOW)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, MAX_RECENT);

  live.sort((a, b) => a.startedAt - b.startedAt);
  return { live, recent };
}

// Cheap status peek for the liveness gate without a full parse.
const statusCache = new Map<string, { status: string; mtime: number }>();
async function peekStatus(j: DiscoveredJournal): Promise<string> {
  const cached = statusCache.get(j.path);
  if (cached && cached.mtime === j.mtime) return cached.status;
  let status = 'unknown';
  try {
    if (j.size <= MAX_JOURNAL) {
      const o = JSON.parse(await readFile(j.path, 'utf8'));
      status = typeof o.status === 'string' ? o.status : 'unknown';
    }
  } catch {
    /* ignore */
  }
  statusCache.set(j.path, { status, mtime: j.mtime });
  return status;
}

let cached: WorkflowsData | null = null;
let cachedAt = 0;

export async function getWorkflows(): Promise<WorkflowsData> {
  const now = Date.now();
  if (cached && now - cachedAt < TTL) return cached;
  cached = await computeWorkflows();
  cachedAt = now;
  return cached;
}
