/**
 * workflow-agent-detail.ts
 * Per-agent detail for one workflow subagent — served lazily by
 * `GET /api/workflows/:runId/agents/:agentId` when a row is expanded.
 *
 * Deliberately NOT part of `/api/workflows`: this parses the agent's whole
 * transcript, which the 4s list poll must never do (a run can hold 100 of them).
 *
 * Two sources, merged:
 *   agent-<id>.jsonl       – tools, failures, token split, turns, skills/MCP, files
 *   workflows/wf_<id>.json – queue wait, attempt, spawn order, result (final runs only)
 */

import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { locateRun, coerceState, queuedMs, type WorkflowAgentState } from './workflows.ts';

export interface WorkflowAgentToolUse {
  name: string;
  count: number;
  failed: number;
}

export interface WorkflowAgentDetail {
  agentId: string;
  agentType: string;
  label: string;
  phaseTitle: string;
  index: number;
  attempt: number;
  state: WorkflowAgentState;
  prompt: string;
  resultSummary: string;
  resultFiles: string[];
  tools: WorkflowAgentToolUse[];
  toolFailures: number;
  turns: number;
  /** cacheRead is excluded from effective tokens — it doesn't count toward rate limits. */
  tokens: { input: number; output: number; cacheCreate: number; cacheRead: number };
  models: string[];
  skills: string[];
  mcpServers: string[];
  queuedMs: number;
  startedAt: number;
  durationMs: number;
}

const MAX_AGENT_FILE = 50 * 1024 * 1024;
const PROMPT_CAP = 4_000;
const SUMMARY_CAP = 600;
const MAX_FILES = 40;
const MAX_TOOLS = 30;

interface TranscriptParse {
  prompt: string;
  tools: Map<string, WorkflowAgentToolUse>;
  toolFailures: number;
  turns: number;
  tokens: WorkflowAgentDetail['tokens'];
  models: Set<string>;
  skills: Set<string>;
  mcpServers: Set<string>;
  files: Set<string>;
  firstTs: number;
  lastTs: number;
  state: WorkflowAgentState | null;
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    for (const b of content) if (b?.type === 'text' && typeof b.text === 'string') return b.text;
  }
  return '';
}

async function parseTranscript(path: string): Promise<TranscriptParse> {
  const out: TranscriptParse = {
    prompt: '',
    tools: new Map(),
    toolFailures: 0,
    turns: 0,
    tokens: { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 },
    models: new Set(),
    skills: new Set(),
    mcpServers: new Set(),
    files: new Set(),
    firstTs: Infinity,
    lastTs: 0,
    state: null,
  };
  // tool_use id → tool name, so a later tool_result's is_error lands on the right tool.
  const toolNameById = new Map<string, string>();
  const requestIds = new Set<string>();

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
    if (typeof obj.attributionSkill === 'string') out.skills.add(obj.attributionSkill);
    if (typeof obj.attributionMcpServer === 'string') out.mcpServers.add(obj.attributionMcpServer);

    if (obj.type === 'user' && obj.message) {
      if (!out.prompt) out.prompt = textOf(obj.message.content).slice(0, PROMPT_CAP);
      const content = obj.message.content;
      if (Array.isArray(content)) {
        for (const b of content) {
          if (b?.type !== 'tool_result' || !b.is_error) continue;
          out.toolFailures++;
          const t = out.tools.get(toolNameById.get(b.tool_use_id) ?? '');
          if (t) t.failed++;
        }
      }
      continue;
    }

    if (obj.type !== 'assistant' || !obj.message) continue;
    if (typeof obj.requestId === 'string') requestIds.add(obj.requestId);
    if (obj.message.model && obj.message.model !== '<synthetic>') out.models.add(obj.message.model);

    const u = obj.message.usage;
    if (u) {
      out.tokens.input += Number(u.input_tokens) || 0;
      out.tokens.output += Number(u.output_tokens) || 0;
      out.tokens.cacheCreate += Number(u.cache_creation_input_tokens) || 0;
      out.tokens.cacheRead += Number(u.cache_read_input_tokens) || 0;
    }

    if (!Array.isArray(obj.message.content)) continue;
    for (const b of obj.message.content) {
      if (b?.type !== 'tool_use' || typeof b.name !== 'string') continue;
      toolNameById.set(b.id, b.name);
      const hit = out.tools.get(b.name);
      if (hit) hit.count++;
      else out.tools.set(b.name, { name: b.name, count: 1, failed: 0 });
      const fp = b.input?.file_path;
      if (typeof fp === 'string' && out.files.size < MAX_FILES) out.files.add(fp);
    }
  }

  out.turns = requestIds.size;
  if (out.firstTs === Infinity) out.firstTs = 0;
  return out;
}

const cache = new Map<string, { mtime: number; parse: TranscriptParse }>();

async function parseTranscriptCached(path: string): Promise<TranscriptParse | null> {
  let s;
  try {
    s = await stat(path);
  } catch {
    return null;
  }
  if (s.size > MAX_AGENT_FILE) return null;
  const hit = cache.get(path);
  if (hit && hit.mtime === s.mtimeMs) return hit.parse;
  try {
    const parse = await parseTranscript(path);
    cache.set(path, { mtime: s.mtimeMs, parse });
    return parse;
  } catch {
    return null;
  }
}

/** That agent's `workflow_agent` entry from the final journal; null while the run is live. */
async function finalEntry(journalPath: string | null, agentId: string): Promise<any | null> {
  if (!journalPath) return null;
  try {
    const o = JSON.parse(await readFile(journalPath, 'utf8'));
    const wp: any[] = Array.isArray(o.workflowProgress) ? o.workflowProgress : [];
    return wp.find((x) => x?.type === 'workflow_agent' && x.agentId === agentId) ?? null;
  } catch {
    return null;
  }
}

/**
 * `resultPreview` is the agent's StructuredOutput — but the journal truncates it, so
 * it is usually *invalid* JSON cut mid-string. Parse when we can, else pull the
 * fields out textually; dumping raw `{"files":[…` at the reader helps nobody.
 */
function parseResultPreview(raw: unknown): { summary: string; files: string[] } {
  if (typeof raw !== 'string') return { summary: '', files: [] };
  try {
    const o = JSON.parse(raw);
    return {
      summary: typeof o?.summary === 'string' ? o.summary : '',
      files: Array.isArray(o?.files) ? o.files.filter((f: unknown) => typeof f === 'string') : [],
    };
  } catch {
    // Truncated: take everything after "summary":" up to the closing quote or the cut.
    const m = raw.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)/);
    const summary = m ? unescapeJson(m[1]) : '';
    const files = [...raw.matchAll(/"((?:[A-Za-z]:\\\\|\/)(?:[^"\\]|\\.)+?)"/g)].map((f) => unescapeJson(f[1]));
    return { summary: summary || (files.length ? '' : raw), files };
  }
}

/** Undo JSON string escaping on a fragment we couldn't hand to JSON.parse. */
function unescapeJson(s: string): string {
  try {
    return JSON.parse(`"${s.replace(/"/g, '\\"')}"`);
  } catch {
    return s.replace(/\\n/g, '\n').replace(/\\\\/g, '\\').replace(/\\"/g, '"');
  }
}

/**
 * Detail for one agent of one run, or null when either is unknown.
 * `agentId` is matched against the run dir's actual listing — never concatenated
 * into a path — so a traversal attempt just misses and 404s.
 */
export async function getAgentDetail(runId: string, agentId: string): Promise<WorkflowAgentDetail | null> {
  const loc = await locateRun(runId);
  if (!loc) return null;

  let files: string[];
  try {
    files = await readdir(loc.dir);
  } catch {
    return null;
  }
  const wanted = `agent-${agentId}.jsonl`;
  if (!files.includes(wanted)) return null;

  const parse = await parseTranscriptCached(join(loc.dir, wanted));
  if (!parse) return null;

  const entry = await finalEntry(loc.journalPath, agentId);
  const result = parseResultPreview(entry?.resultPreview);
  const summary =
    result.summary ||
    (typeof entry?.lastToolSummary === 'string' ? entry.lastToolSummary : '');

  let meta: any = {};
  try {
    meta = JSON.parse(await readFile(join(loc.dir, `agent-${agentId}.meta.json`), 'utf8'));
  } catch {
    /* live runs always have it; older ones may not */
  }

  const durationMs = Number(entry?.durationMs) || Math.max(0, parse.lastTs - parse.firstTs);

  return {
    agentId,
    agentType: String(entry?.agentType ?? meta?.agentType ?? ''),
    label: String(entry?.label ?? ''),
    phaseTitle: String(entry?.phaseTitle ?? ''),
    index: Number(entry?.index) || 0,
    attempt: Math.max(1, Number(entry?.attempt) || 0),
    state: entry ? coerceState(entry.state) : 'running',
    prompt: parse.prompt,
    resultSummary: summary.slice(0, SUMMARY_CAP),
    resultFiles: [...new Set([...result.files, ...parse.files])].slice(0, MAX_FILES),
    tools: [...parse.tools.values()].sort((a, b) => b.count - a.count).slice(0, MAX_TOOLS),
    toolFailures: parse.toolFailures,
    turns: parse.turns,
    tokens: parse.tokens,
    models: [...parse.models],
    skills: [...parse.skills],
    mcpServers: [...parse.mcpServers],
    queuedMs: entry ? queuedMs(entry) : 0,
    startedAt: Number(entry?.startedAt) || parse.firstTs,
    durationMs,
  };
}
