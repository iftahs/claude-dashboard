/**
 * subagents-live.ts
 * getLiveSubagents() with 3s TTL cache.
 * Detects running subagents by:
 *   (a) Finding Agent tool_use blocks in files modified within last 30 min with no matching result
 *   (b) Finding sidechain files modified within last 90s → active workers
 *   (c) Matching by agentId from tool_result or prompt prefix
 */

import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { claudeDir } from './scan.ts';

export interface LiveSubagent {
  key: string;
  name: string;
  description: string;
  model: string;
  startedAt: number;
  lastActivity: number;
  effectiveTokens: number;
  project: string;
  status: 'running';
}

export interface RecentlyCompletedSubagent {
  name: string;
  description: string;
  model: string;
  completedAt: number;
}

export interface LiveSubagentsData {
  running: LiveSubagent[];
  recentlyCompleted: RecentlyCompletedSubagent[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function projectsDir(): string {
  return join(claudeDir(), 'projects');
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

async function listJsonl(dir: string): Promise<{ path: string; mtime: number; size: number }[]> {
  let entries: { path: string; mtime: number; size: number }[] = [];
  let dirents;
  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const d of dirents) {
    const full = join(dir, d.name);
    if (d.isDirectory()) {
      entries = entries.concat(await listJsonl(full));
    } else if (d.isFile() && d.name.endsWith('.jsonl')) {
      try {
        const s = await stat(full);
        entries.push({ path: full, mtime: s.mtimeMs, size: s.size });
      } catch { /* skip */ }
    }
  }
  return entries;
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
  } catch { /* keep empty */ }
  return '';
}

function projectNameFromPath(projectPath: string): string {
  return projectPath.split(/[\\\/]/).filter(Boolean).pop() ?? projectPath;
}

function agentIdFromFileName(file: string): string | undefined {
  const parts = file.replace(/\\/g, '/').split('/');
  const name = parts[parts.length - 1];
  const m = name.match(/^agent-([a-z0-9]+)\.jsonl$/);
  return m ? m[1] : undefined;
}

interface SpawnRec {
  id: string;
  description: string;
  subagentType: string;
  model: string | null;
  promptPrefix: string;
  ts: number;
}

interface ResultRec {
  toolUseId: string;
  ts: number;
  agentId: string | null;
  /** Background launches return a tool_result immediately — it is NOT a completion. */
  isAsyncLaunch: boolean;
}

async function parseFileForAgentSpawns(file: string): Promise<{
  spawns: SpawnRec[];
  results: Map<string, ResultRec>;
  /** Background-agent completions arrive later as <task-notification> user entries. */
  notifications: Array<{ agentId: string; ts: number }>;
}> {
  const spawns: SpawnRec[] = [];
  const results = new Map<string, ResultRec>();
  const notifications: Array<{ agentId: string; ts: number }> = [];

  const rl = createInterface({
    input: createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line || line.length < 2) continue;
    let obj: any;
    try { obj = JSON.parse(line); } catch { continue; }

    const ts = Date.parse(obj.timestamp ?? '');
    if (Number.isNaN(ts)) continue;

    // Background completions are enqueued instantly as queue-operation entries,
    // before the same text lands as a user message on the next turn.
    if (obj.type === 'queue-operation' && typeof obj.content === 'string') {
      const m = obj.content.match(/<task-id>([a-z0-9]+)<\/task-id>[\s\S]*?<status>completed<\/status>/);
      if (m) notifications.push({ agentId: m[1], ts });
      continue;
    }

    if (obj.type === 'assistant' && Array.isArray(obj.message?.content)) {
      for (const block of obj.message.content) {
        if (block?.type === 'tool_use' && (block.name === 'Agent' || block.name === 'Task')) {
          spawns.push({
            id: block.id ?? '',
            description: (block.input?.description ?? '').slice(0, 200),
            subagentType: block.input?.subagent_type ?? block.input?.agentType ?? 'agent',
            model: block.input?.model ?? null,
            promptPrefix: String(block.input?.prompt ?? '').slice(0, 150),
            ts,
          });
        }
      }
    }

    if (obj.type === 'user' && obj.message) {
      const content = obj.message.content;
      if (typeof content === 'string') {
        const m = content.match(/<task-id>([a-z0-9]+)<\/task-id>[\s\S]*?<status>completed<\/status>/);
        if (m) notifications.push({ agentId: m[1], ts });
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === 'text' && typeof block.text === 'string') {
            const m = block.text.match(/<task-id>([a-z0-9]+)<\/task-id>[\s\S]*?<status>completed<\/status>/);
            if (m) notifications.push({ agentId: m[1], ts });
          }
          if (block?.type === 'tool_result') {
            const toolUseId: string = block.tool_use_id ?? '';
            let resultText = '';
            if (typeof block.content === 'string') {
              resultText = block.content;
            } else if (Array.isArray(block.content)) {
              for (const tb of block.content) {
                if (tb?.type === 'text' && typeof tb.text === 'string') resultText += tb.text;
              }
            }
            const agentIdMatch = resultText.match(/agentId:\s*([a-z0-9]+)/);
            results.set(toolUseId, {
              toolUseId,
              ts,
              agentId: agentIdMatch ? agentIdMatch[1] : null,
              isAsyncLaunch: /Async agent launched/i.test(resultText),
            });
          }
        }
      }
    }
  }

  return { spawns, results, notifications };
}

interface SidechainInfo {
  agentId: string;
  effectiveTokens: number;
  firstTs: number;
  lastTs: number;
  model: string;
  firstUserText: string;
  projectPath: string;
  mtime: number;
}

async function parseSidechainFile(file: string, agentId: string, mtime: number): Promise<SidechainInfo> {
  let effectiveTokens = 0;
  let firstTs = Infinity;
  let lastTs = 0;
  let model = 'unknown';
  let firstUserText = '';

  const rl = createInterface({
    input: createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line || line.length < 2) continue;
    let obj: any;
    try { obj = JSON.parse(line); } catch { continue; }

    const ts = Date.parse(obj.timestamp ?? '');
    if (Number.isNaN(ts)) continue;
    if (ts < firstTs) firstTs = ts;
    if (ts > lastTs) lastTs = ts;

    if (!firstUserText && obj.type === 'user' && obj.message) {
      const c = obj.message.content;
      if (typeof c === 'string') firstUserText = c.slice(0, 150);
      else if (Array.isArray(c)) {
        for (const b of c) {
          if (b?.type === 'text' && typeof b.text === 'string') { firstUserText = b.text.slice(0, 150); break; }
        }
      }
    }

    if (obj.type === 'assistant' && obj.message?.usage) {
      const usage = obj.message.usage;
      effectiveTokens += num(usage.input_tokens) + num(usage.output_tokens) + num(usage.cache_creation_input_tokens);
      if (obj.message?.model && obj.message.model !== 'unknown' && obj.message.model !== '<synthetic>') model = obj.message.model;
    }
  }

  return {
    agentId,
    effectiveTokens,
    firstTs: firstTs === Infinity ? 0 : firstTs,
    lastTs,
    model,
    firstUserText,
    projectPath: projectPathFromFile(file),
    mtime,
  };
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

async function computeLiveSubagents(): Promise<LiveSubagentsData> {
  const now = Date.now();
  const THIRTY_MIN = 30 * 60_000;
  const ACTIVE_WINDOW = 5 * 60_000; // sidechain writes can pause during long LLM turns
  const ONE_MIN = 60_000;

  const allFiles = await listJsonl(projectsDir());
  const isSidechainPath = (p: string) => p.includes('/subagents/') || p.includes('\\subagents\\');

  // Parent conversations modified in the last 30 min — source of spawns/results/notifications.
  const recentParentFiles = allFiles.filter(
    (f) => now - f.mtime < THIRTY_MIN && f.size <= 5 * 1024 * 1024 && !isSidechainPath(f.path)
  );

  // Sidechain transcripts modified in the last 30 min — model/token enrichment + activity signal.
  const sidechains = new Map<string, SidechainInfo>();
  for (const f of allFiles) {
    if (now - f.mtime >= THIRTY_MIN || f.size > 5 * 1024 * 1024 || !isSidechainPath(f.path)) continue;
    const agentId = agentIdFromFileName(f.path);
    if (!agentId) continue;
    sidechains.set(agentId, await parseSidechainFile(f.path, agentId, f.mtime));
  }

  const running: LiveSubagent[] = [];
  const recentlyCompleted: RecentlyCompletedSubagent[] = [];
  const claimedAgentIds = new Set<string>();

  for (const pf of recentParentFiles) {
    const parsed = await parseFileForAgentSpawns(pf.path);
    const project = projectNameFromPath(projectPathFromFile(pf.path));
    const notifiedAt = new Map(parsed.notifications.map((n) => [n.agentId, n.ts]));

    for (const spawn of parsed.spawns) {
      if (now - spawn.ts >= THIRTY_MIN) continue;
      const result = parsed.results.get(spawn.id);

      // Link spawn → sidechain: by agentId from an async-launch result, else by prompt prefix.
      let sc: SidechainInfo | undefined;
      if (result?.agentId) sc = sidechains.get(result.agentId);
      if (!sc && spawn.promptPrefix) {
        for (const cand of sidechains.values()) {
          if (claimedAgentIds.has(cand.agentId)) continue;
          if (cand.firstUserText && spawn.promptPrefix.startsWith(cand.firstUserText.slice(0, 80))) {
            sc = cand;
            break;
          }
        }
      }
      if (sc) claimedAgentIds.add(sc.agentId);

      const model = sc && sc.model !== 'unknown' ? sc.model : (spawn.model ?? 'inherit');
      const doneAt =
        result && !result.isAsyncLaunch
          ? result.ts // foreground completion = the real tool_result
          : sc
            ? notifiedAt.get(sc.agentId) // background completion = task-notification
            : result?.agentId
              ? notifiedAt.get(result.agentId)
              : undefined;

      if (doneAt !== undefined) {
        if (now - doneAt < ONE_MIN) {
          recentlyCompleted.push({ name: spawn.subagentType, description: spawn.description, model, completedAt: doneAt });
        }
        continue;
      }

      // Still running. Background agents without a fresh sidechain are likely finished in a
      // way we missed (or hung) — only show them while their transcript is recently active.
      const isBackground = result?.isAsyncLaunch === true;
      if (isBackground && (!sc || now - sc.mtime >= ACTIVE_WINDOW)) continue;

      running.push({
        key: spawn.id,
        name: spawn.subagentType,
        description: spawn.description,
        model,
        startedAt: spawn.ts,
        lastActivity: sc ? Math.max(sc.lastTs, sc.mtime) : spawn.ts,
        effectiveTokens: sc?.effectiveTokens ?? 0,
        project,
        status: 'running',
      });
    }
  }

  // Fresh sidechains not claimed by any spawn (parent rotated/compacted): still show them.
  for (const sc of sidechains.values()) {
    if (claimedAgentIds.has(sc.agentId) || now - sc.mtime >= ACTIVE_WINDOW) continue;
    running.push({
      key: sc.agentId,
      name: 'subagent',
      description: sc.firstUserText.slice(0, 80),
      model: sc.model,
      startedAt: sc.firstTs || sc.mtime,
      lastActivity: Math.max(sc.lastTs, sc.mtime),
      effectiveTokens: sc.effectiveTokens,
      project: projectNameFromPath(sc.projectPath),
      status: 'running',
    });
  }

  running.sort((a, b) => a.startedAt - b.startedAt);
  recentlyCompleted.sort((a, b) => b.completedAt - a.completedAt);
  return { running, recentlyCompleted };
}

// ---------------------------------------------------------------------------
// 3s TTL cache
// ---------------------------------------------------------------------------

const LIVE_TTL_MS = 3_000;

let cachedLive: LiveSubagentsData | null = null;
let cachedLiveAt = 0;

export async function getLiveSubagents(): Promise<LiveSubagentsData> {
  const now = Date.now();
  if (cachedLive && now - cachedLiveAt < LIVE_TTL_MS) {
    return cachedLive;
  }
  const data = await computeLiveSubagents();
  cachedLive = data;
  cachedLiveAt = now;
  return data;
}
