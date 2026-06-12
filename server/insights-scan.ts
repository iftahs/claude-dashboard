/**
 * insights-scan.ts
 * Second scanner with its own 30s TTL cache (independent of main cache.ts).
 * Collects tool calls, tool results, task spawns, session metadata, and a
 * search corpus for the analytics/insights endpoints.
 */

import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { estimateCost } from './pricing.ts';
import { scanRoots, keepScanFile, type UsageSource } from './scan.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ToolCallRecord {
  ts: number;
  sessionId: string;
  name: string;
  isSidechain: boolean;
  mcpServer: string | null;
  filePath: string | null;
  gitBranch: string;
  projectPath: string;
  id: string;
  source: UsageSource;
}

export interface ToolResultRecord {
  id: string; // tool_use_id
  is_error: boolean;
  rejected: boolean;
  errorText: string; // first 200 chars when is_error
}

export interface TaskSpawnRecord {
  ts: number;
  sessionId: string;
  id: string; // tool_use_id
  subagentType: string;
  model: string | null;
  description: string;
  agentIdFromResult: string | null;
  completed: boolean;
  gitBranch: string;
  projectPath: string;
  source: UsageSource;
}

export interface SessionMetaRecord {
  sessionId: string;
  isSidechain: boolean;
  firstTs: number;
  lastTs: number;
  turns: number;
  assistantMsgs: number;
  toolCallCount: number;
  errorCount: number;
  rejectionCount: number;
  subagentSpawns: number;
  compactions: number;
  committed: boolean;
  gitCommits: number;
  gitPushes: number;
  firstPrompt: string;
  gitBranch: string;
  projectPath: string;
  models: Record<string, number>;
  effectiveTokens: number;
  cost: number;
  file: string;
  agentId?: string;
  source: UsageSource; // 'code' = Claude Code CLI, 'cowork' = desktop local-agent mode
}

export interface InsightsData {
  toolCalls: ToolCallRecord[];
  toolResults: Map<string, ToolResultRecord>;
  taskSpawns: TaskSpawnRecord[];
  sessionsMeta: Map<string, SessionMetaRecord>;
  searchCorpus: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Path helpers (mirrored from scan.ts logic)
// ---------------------------------------------------------------------------

function decodeProjectPath(encoded: string): string {
  if (/^[A-Za-z]--/.test(encoded)) {
    const letter = encoded[0].toLowerCase();
    const rest = encoded.slice(3).replace(/--/g, '\\');
    return `${letter}:\\${rest}`;
  }
  return '/' + encoded.replace(/--/g, '/');
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

// ---------------------------------------------------------------------------
// File listing (recursive, including subagent directories)
// ---------------------------------------------------------------------------

async function listAllJsonl(dir: string, source: UsageSource = 'code'): Promise<string[]> {
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
      entries = entries.concat(await listAllJsonl(full, source));
    } else if (d.isFile() && d.name.endsWith('.jsonl') && keepScanFile(full, source)) {
      entries.push(full);
    }
  }
  return entries;
}

/** Every scanned jsonl file paired with its source, across all scan roots. */
async function listAllRootFiles(): Promise<{ file: string; source: UsageSource }[]> {
  const perRoot = await Promise.all(
    scanRoots().map(async (r) => (await listAllJsonl(r.dir, r.source)).map((file) => ({ file, source: r.source })))
  );
  return perRoot.flat();
}

export async function projectsFingerprint(): Promise<number> {
  const files = await listAllRootFiles();
  let newest = 0;
  await Promise.all(
    files.map(async ({ file }) => {
      try {
        const s = await stat(file);
        if (s.mtimeMs > newest) newest = s.mtimeMs;
      } catch { /* ignore */ }
    })
  );
  return newest;
}

// ---------------------------------------------------------------------------
// MCP server extraction from tool name
// e.g. "mcp__context7__resolve-library-id" → "context7"
// ---------------------------------------------------------------------------

function extractMcpServer(name: string): string | null {
  const m = name.match(/^mcp__([^_]+(?:_[^_]+)*)__/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// File path extraction from tool input
// ---------------------------------------------------------------------------

function extractFilePath(input: any): string | null {
  if (!input || typeof input !== 'object') return null;
  const fp = input.file_path ?? input.path ?? input.filePath ?? null;
  return typeof fp === 'string' ? fp : null;
}

// ---------------------------------------------------------------------------
// Project path from JSONL file path
// ---------------------------------------------------------------------------

function projectPathFromFile(file: string): string {
  try {
    const parts = file.replace(/\\/g, '/').split('/');
    const projIdx = parts.lastIndexOf('projects');
    if (projIdx !== -1 && parts[projIdx + 1]) {
      return decodeProjectPath(decodeURIComponent(parts[projIdx + 1]));
    }
  } catch { /* keep empty */ }
  return '';
}

// ---------------------------------------------------------------------------
// Agent ID from file name: agent-<agentId>.jsonl
// ---------------------------------------------------------------------------

function agentIdFromFileName(file: string): string | undefined {
  const parts = file.replace(/\\/g, '/').split('/');
  const name = parts[parts.length - 1];
  const m = name.match(/^agent-([a-z0-9]+)\.jsonl$/);
  return m ? m[1] : undefined;
}

/** A file is a sidechain file if it lives under a "subagents" directory. */
function isSubagentFile(file: string): boolean {
  return /[/\\]subagents[/\\]/.test(file);
}

// ---------------------------------------------------------------------------
// Detect git commit from Bash/PowerShell tool_use (paired with non-error result)
// ---------------------------------------------------------------------------

function isGitCommitCommand(toolName: string, input: any): boolean {
  if (toolName !== 'Bash' && toolName !== 'PowerShell') return false;
  const cmd = typeof input?.command === 'string' ? input.command : '';
  return /git\s+commit/.test(cmd);
}

function isGitPushCommand(toolName: string, input: any): boolean {
  if (toolName !== 'Bash' && toolName !== 'PowerShell') return false;
  const cmd = typeof input?.command === 'string' ? input.command : '';
  return /git\s+push/.test(cmd);
}

// ---------------------------------------------------------------------------
// Main scan function
// ---------------------------------------------------------------------------

export async function scanInsights(): Promise<InsightsData> {
  const files = await listAllRootFiles();

  const toolCalls: ToolCallRecord[] = [];
  // Map tool_use_id → ToolResultRecord
  const toolResults = new Map<string, ToolResultRecord>();
  const taskSpawns: TaskSpawnRecord[] = [];
  const sessionsMeta = new Map<string, SessionMetaRecord>();
  const searchCorpus = new Map<string, string>();

  // Dedup assistant messages by requestId:msgId (keep max-effective same as scan.ts)
  const seenAssistant = new Map<string, { effectiveTokens: number; model: string; input: number; output: number; cacheCreate: number }>();
  // Pending git tool_use_ids (tool_use_id → sessionId), resolved when we see a non-error tool_result
  const pendingGitCommits = new Map<string, string>();
  const pendingGitPushes = new Map<string, string>();

  for (const { file, source } of files) {
    // Skip files > 5MB
    try {
      const st = await stat(file);
      if (st.size > 5 * 1024 * 1024) continue;
    } catch { continue; }

    // Cowork transcripts encode a sandbox-internal path that is meaningless on the
    // host, so leave it empty (keeps cowork sessions out of the Projects tab).
    const projectPath = source === 'cowork' ? '' : projectPathFromFile(file);
    const agentId = agentIdFromFileName(file);
    // Determine isSidechain from file path: subagent files are under a "subagents/" dir.
    // This is more reliable than the per-entry flag because all entries in a subagent file
    // share the parent sessionId but mark isSidechain=true, which would incorrectly flip
    // the parent session's isSidechain flag.
    const fileIsSidechain = isSubagentFile(file);

    const rl = createInterface({
      input: createReadStream(file, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line || line.length < 2) continue;
      let obj: any;
      try { obj = JSON.parse(line); } catch { continue; }

      const sessionId: string = obj.sessionId ?? obj.session_id ?? '';
      const gitBranch: string = typeof obj.gitBranch === 'string' ? obj.gitBranch : '';
      const ts = Date.parse(obj.timestamp ?? '');
      if (Number.isNaN(ts)) continue;

      // Ensure session meta exists
      let sm = sessionsMeta.get(sessionId);
      if (!sm) {
        sm = {
          sessionId,
          isSidechain: fileIsSidechain,
          firstTs: ts,
          lastTs: ts,
          turns: 0,
          assistantMsgs: 0,
          toolCallCount: 0,
          errorCount: 0,
          rejectionCount: 0,
          subagentSpawns: 0,
          compactions: 0,
          committed: false,
          gitCommits: 0,
          gitPushes: 0,
          firstPrompt: '',
          gitBranch,
          projectPath,
          models: {},
          effectiveTokens: 0,
          cost: 0,
          file,
          agentId,
          source,
        };
        sessionsMeta.set(sessionId, sm);
      } else if (!fileIsSidechain && sm.isSidechain) {
        // A non-sidechain file (parent session JSONL) can override isSidechain=true
        // that may have been set by a subagent file processed earlier.
        // The parent file is authoritative for isSidechain classification.
        sm.isSidechain = false;
      }
      if (ts < sm.firstTs) sm.firstTs = ts;
      if (ts > sm.lastTs) sm.lastTs = ts;
      if (gitBranch && !sm.gitBranch) sm.gitBranch = gitBranch;

      // Compaction detection: type === 'summary'
      if (obj.type === 'summary') {
        sm.compactions++;
        continue;
      }

      // User message
      if (obj.type === 'user' && obj.message?.role === 'user') {
        sm.turns++;

        const content = obj.message.content;

        // String content
        if (typeof content === 'string') {
          // Compaction detection: text contains continuation marker
          if (/continued from a previous conversation/i.test(content)) {
            sm.compactions++;
          }
          // First real user prompt (skip system-reminder / command wrappers)
          if (!sm.firstPrompt) {
            const t = content.trim();
            if (t && !t.startsWith('<')) sm.firstPrompt = t.slice(0, 200);
          }
          // Search corpus: first 200 chars of each user text turn, max 20KB/session
          const existing = searchCorpus.get(sessionId) ?? '';
          if (existing.length < 20 * 1024) {
            const snippet = content.slice(0, 200);
            searchCorpus.set(sessionId, existing ? existing + ' ' + snippet : snippet);
          }
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (!block || typeof block !== 'object') continue;

            // Text blocks: add to corpus + check compaction
            if (block.type === 'text' && typeof block.text === 'string') {
              if (/continued from a previous conversation/i.test(block.text)) {
                sm.compactions++;
              }
              if (!sm.firstPrompt) {
                const t = block.text.trim();
                if (t && !t.startsWith('<')) sm.firstPrompt = t.slice(0, 200);
              }
              const existing = searchCorpus.get(sessionId) ?? '';
              if (existing.length < 20 * 1024) {
                const snippet = block.text.slice(0, 200);
                searchCorpus.set(sessionId, existing ? existing + ' ' + snippet : snippet);
              }
            }

            // tool_result blocks
            if (block.type === 'tool_result') {
              const toolUseId: string = block.tool_use_id ?? '';
              const isError: boolean = block.is_error === true;
              const rejected: boolean = block.rejected === true ||
                (typeof block.content === 'string' && /reject|doesn't want to proceed|denied/i.test(block.content));

              let errorText = '';
              if (isError) {
                if (typeof block.content === 'string') {
                  errorText = block.content.slice(0, 200);
                } else if (Array.isArray(block.content)) {
                  const textBlock = block.content.find((b: any) => b?.type === 'text');
                  if (textBlock?.text) errorText = String(textBlock.text).slice(0, 200);
                }
              }

              toolResults.set(toolUseId, { id: toolUseId, is_error: isError, rejected, errorText });

              if (isError) sm.errorCount++;
              if (rejected) sm.rejectionCount++;

              // Check for git commit resolution
              if (!isError && pendingGitCommits.has(toolUseId)) {
                sm.committed = true;
                sm.gitCommits++;
                pendingGitCommits.delete(toolUseId);
              }
              // Check for git push resolution
              if (!isError && pendingGitPushes.has(toolUseId)) {
                sm.gitPushes++;
                pendingGitPushes.delete(toolUseId);
              }

              // Check for agentId in tool_result text (from Task/Agent spawns)
              let resultText = '';
              if (typeof block.content === 'string') {
                resultText = block.content;
              } else if (Array.isArray(block.content)) {
                for (const tb of block.content) {
                  if (tb?.type === 'text' && typeof tb.text === 'string') {
                    resultText += tb.text;
                  }
                }
              }
              if (resultText) {
                const agentIdMatch = resultText.match(/agentId:\s*([a-z0-9]+)/);
                if (agentIdMatch) {
                  // Update matching task spawn
                  const agentIdFromResult = agentIdMatch[1];
                  const spawn = taskSpawns.find((t) => t.id === toolUseId && t.sessionId === sessionId);
                  if (spawn) {
                    spawn.agentIdFromResult = agentIdFromResult;
                    spawn.completed = true;
                  }
                }
              }
            }
          }
        }
      }

      // Assistant message
      if (obj.type === 'assistant' && obj.message?.role === 'assistant') {
        const usage = obj.message?.usage;
        const model: string = obj.message?.model ?? 'unknown';
        const requestId: string = obj.requestId ?? '';
        const msgId: string = obj.message?.id ?? '';
        const key = `${requestId}:${msgId}`;

        sm.assistantMsgs++;

        // Token accounting with dedup (keep-max)
        const inTok = num(usage?.input_tokens);
        const outTok = num(usage?.output_tokens);
        const cacheCreate = num(usage?.cache_creation_input_tokens);
        const eff = inTok + outTok + cacheCreate;

        if (key !== ':' && usage) {
          const prev = seenAssistant.get(key);
          if (prev) {
            if (eff > prev.effectiveTokens) {
              // Replace previous contribution
              sm.effectiveTokens = sm.effectiveTokens - prev.effectiveTokens + eff;
              sm.cost = sm.cost - estimateCost(prev.model, { inputTokens: prev.input, outputTokens: prev.output, cacheCreateTokens: prev.cacheCreate, cacheReadTokens: 0 })
                + estimateCost(model, { inputTokens: inTok, outputTokens: outTok, cacheCreateTokens: cacheCreate, cacheReadTokens: 0 });
              seenAssistant.set(key, { effectiveTokens: eff, model, input: inTok, output: outTok, cacheCreate });
            }
            // Skip duplicate regardless
          } else {
            seenAssistant.set(key, { effectiveTokens: eff, model, input: inTok, output: outTok, cacheCreate });
            sm.effectiveTokens += eff;
            sm.cost += estimateCost(model, { inputTokens: inTok, outputTokens: outTok, cacheCreateTokens: cacheCreate, cacheReadTokens: 0 });
            sm.models[model] = (sm.models[model] ?? 0) + eff;
          }
        }

        // Tool calls in content
        const msgContent = obj.message?.content;
        if (Array.isArray(msgContent)) {
          for (const block of msgContent) {
            if (!block || block.type !== 'tool_use') continue;
            const toolName: string = block.name ?? '';
            const toolId: string = block.id ?? '';
            const toolInput = block.input ?? {};

            sm.toolCallCount++;

            const mcpServer = extractMcpServer(toolName);
            const filePath = extractFilePath(toolInput);

            toolCalls.push({
              ts,
              sessionId,
              name: toolName,
              isSidechain: fileIsSidechain,
              mcpServer,
              filePath,
              gitBranch,
              projectPath,
              id: toolId,
              source,
            });

            // Task/Agent spawn detection
            if (toolName === 'Agent' || toolName === 'Task') {
              const subagentType: string = toolInput.subagent_type ?? toolInput.agentType ?? 'unknown';
              const spawnModel: string | null = toolInput.model ?? null;
              const description: string = toolInput.description ?? '';

              taskSpawns.push({
                ts,
                sessionId,
                id: toolId,
                subagentType,
                model: spawnModel,
                description: description.slice(0, 200),
                agentIdFromResult: null,
                completed: false,
                gitBranch,
                projectPath,
                source,
              });

              sm.subagentSpawns++;
            }

            // Git commit / push tracking (resolved on non-error tool_result)
            if (isGitCommitCommand(toolName, toolInput)) {
              pendingGitCommits.set(toolId, sessionId);
            }
            if (isGitPushCommand(toolName, toolInput)) {
              pendingGitPushes.set(toolId, sessionId);
            }
          }
        }
      }
    }
  }

  // Sort tool calls and task spawns by time
  toolCalls.sort((a, b) => a.ts - b.ts);
  taskSpawns.sort((a, b) => a.ts - b.ts);

  return { toolCalls, toolResults, taskSpawns, sessionsMeta, searchCorpus };
}

// ---------------------------------------------------------------------------
// 30s TTL cache
// ---------------------------------------------------------------------------

const INSIGHTS_TTL_MS = 30_000;

let cachedInsights: InsightsData | null = null;
let cachedInsightsAt = 0;
let cachedInsightsFp = -1;
let inflightInsights: Promise<InsightsData> | null = null;

export async function getInsights(): Promise<{ insights: InsightsData; computedAt: number }> {
  const now = Date.now();
  if (cachedInsights && now - cachedInsightsAt < INSIGHTS_TTL_MS) {
    return { insights: cachedInsights, computedAt: cachedInsightsAt };
  }
  if (inflightInsights) {
    await inflightInsights;
    return { insights: cachedInsights!, computedAt: cachedInsightsAt };
  }

  inflightInsights = (async () => {
    const fp = await projectsFingerprint();
    if (fp === cachedInsightsFp && cachedInsightsAt !== 0) {
      cachedInsightsAt = Date.now();
      return cachedInsights!;
    }
    const data = await scanInsights();
    cachedInsights = data;
    cachedInsightsFp = fp;
    cachedInsightsAt = Date.now();
    return data;
  })();

  try {
    await inflightInsights;
  } finally {
    inflightInsights = null;
  }

  return { insights: cachedInsights!, computedAt: cachedInsightsAt };
}
