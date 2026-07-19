/**
 * scan-pass.ts — the single file-reading pass.
 *
 * Replaces the two independent scanners (scan.ts::scanEvents and
 * insights-scan.ts::scanInsights) that each walked the same tree and ran their
 * own JSON.parse over the same ~1.1 GB. One walk, one read, one parse per line,
 * feeding both consumers.
 *
 * This module is deliberately *pure extraction*: it emits flat per-file rows and
 * does no cross-file reduction. All dedup and accumulation happens in merge.ts.
 * That split is what makes per-file caching correct — 28% of dedup keys appear in
 * more than one file, so per-file aggregates cannot be pre-summed without
 * double-counting. Rows carry their dedup keys; merge.ts reduces globally.
 *
 * Reading strategy is measured, not assumed (see docs in the perf report):
 * the scan is CPU-bound on JSON.parse, not I/O — raw reads of the whole corpus
 * take 0.69s while parsing every line takes 6.6s. Hence:
 *   - a substring pre-filter before JSON.parse on the usage-only path
 *   - a bounded pool of PARSE_CONCURRENCY (8 measured optimal; 16 and 24 are worse)
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { keepScanFile, scanRoots, type UsageSource } from './scan.ts';

/** Measured optimum on an NVMe SSD: 1→4.28s, 8→3.11s, 16→3.27s, 24→3.74s. */
export const PARSE_CONCURRENCY = 8;

/** insights-scan.ts has always skipped files above this size; preserved verbatim. */
const INSIGHTS_MAX_FILE_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Row types — flat, serialisable, no Maps. Everything here can go straight into
// SQLite and come back out unchanged.
// ---------------------------------------------------------------------------

export interface UsageRow {
  dedupKey: string; // `${requestId}:${message.id}` — ':' when both absent
  ts: number;
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  tools: string[];
  isSidechain: boolean;
  rootSessionId: string;
  attributionAgent: string;
  attributionSkill: string;
  attributionMcpServer: string;
  attributionPlugin: string;
  /** Path decoded from the file location. The session-meta override is applied in merge.ts. */
  projectPathRaw: string;
  gitBranch: string;
  source: UsageSource;
}

export interface ToolCallRow {
  toolId: string;
  ts: number;
  sessionId: string;
  name: string;
  isSidechain: boolean;
  mcpServer: string | null;
  filePath: string | null;
  gitBranch: string;
  projectPath: string;
  source: UsageSource;
}

export interface ToolResultRow {
  toolId: string;
  sessionId: string;
  isError: boolean;
  rejected: boolean;
  errorText: string;
  /** Extracted here so merge.ts never has to re-read result bodies. */
  agentIdFromResult: string | null;
}

export interface TaskSpawnRow {
  toolId: string;
  ts: number;
  sessionId: string;
  subagentType: string;
  model: string | null;
  description: string;
  gitBranch: string;
  projectPath: string;
  source: UsageSource;
}

export interface SessionPartialRow {
  sessionId: string;
  fileIsSidechain: boolean;
  firstTs: number;
  lastTs: number;
  turns: number;
  compactions: number;
  errorCount: number;
  rejectionCount: number;
  firstPrompt: string;
  gitBranch: string;
  projectPath: string;
  file: string;
  agentId: string | null;
  source: UsageSource;
  /** Distinct assistant-message identities seen in this file (for assistantMsgs). */
  assistantKeys: string[];
  /** tool_use ids of git commit/push commands, resolved against results in merge.ts. */
  gitCommitIds: string[];
  gitPushIds: string[];
  /** tool_use ids whose result came back non-error — resolves the two lists above. */
  nonErrorResultIds: string[];
}

export interface CorpusRow {
  sessionId: string;
  snippets: string[];
}

export interface FileRows {
  path: string;
  source: UsageSource;
  mtimeMs: number;
  size: number;
  /** True when the file exceeded INSIGHTS_MAX_FILE_BYTES — usage rows only. */
  insightsSkipped: boolean;
  usage: UsageRow[];
  toolCalls: ToolCallRow[];
  toolResults: ToolResultRow[];
  taskSpawns: TaskSpawnRow[];
  sessions: SessionPartialRow[];
  corpus: CorpusRow[];
}

export interface ScannedFile {
  path: string;
  source: UsageSource;
  mtimeMs: number;
  size: number;
}

// ---------------------------------------------------------------------------
// Walk — parallel per-directory. Measured at 0.06s for 2,608 files, so this has
// never been the bottleneck; it is parallel only because it costs nothing.
// ---------------------------------------------------------------------------

async function walk(dir: string, source: UsageSource, acc: string[]): Promise<void> {
  let dirents;
  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  await Promise.all(
    dirents.map(async (d) => {
      const full = join(dir, d.name);
      if (d.isDirectory()) await walk(full, source, acc);
      else if (d.isFile() && d.name.endsWith('.jsonl') && keepScanFile(full, source)) acc.push(full);
    })
  );
}

/** Every scanned jsonl file with its stat metadata, sorted for deterministic merge order. */
export async function listScannedFiles(): Promise<ScannedFile[]> {
  const out: ScannedFile[] = [];
  for (const root of scanRoots()) {
    const paths: string[] = [];
    await walk(root.dir, root.source, paths);
    // Sort within a root so merge order (which decides "first file wins" fields
    // like projectPath and firstPrompt) is stable across runs and machines.
    paths.sort();
    for (const p of paths) out.push({ path: p, source: root.source, mtimeMs: 0, size: 0 });
  }
  await runPool(out, 32, async (f) => {
    try {
      const s = await stat(f.path);
      f.mtimeMs = s.mtimeMs;
      f.size = s.size;
    } catch {
      f.mtimeMs = -1;
      f.size = -1;
    }
  });
  return out.filter((f) => f.size >= 0);
}

/** Bounded-concurrency map. Shared by the walk, the stat sweep and the parse pass. */
export async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

// ---------------------------------------------------------------------------
// Path helpers — kept identical to the originals in scan.ts / insights-scan.ts
// ---------------------------------------------------------------------------

function decodeProjectPath(encoded: string): string {
  if (/^[A-Za-z]--/.test(encoded)) {
    const letter = encoded[0].toLowerCase();
    const rest = encoded.slice(3).replace(/--/g, '\\');
    return `${letter}:\\${rest}`;
  }
  return '/' + encoded.replace(/--/g, '/');
}

function projectPathFromFile(file: string): string {
  try {
    const parts = file.replace(/\\/g, '/').split('/');
    const projIdx = parts.lastIndexOf('projects');
    if (projIdx !== -1 && parts[projIdx + 1]) {
      return decodeProjectPath(decodeURIComponent(parts[projIdx + 1]));
    }
  } catch {
    /* keep empty */
  }
  return '';
}

function agentIdFromFileName(file: string): string | null {
  const parts = file.replace(/\\/g, '/').split('/');
  const m = parts[parts.length - 1].match(/^agent-([a-z0-9]+)\.jsonl$/);
  return m ? m[1] : null;
}

function isSubagentFile(file: string): boolean {
  return /[/\\]subagents[/\\]/.test(file);
}

function parentSessionFromPath(file: string): string {
  return file.replace(/\\/g, '/').match(/\/([^/]+)\/subagents\//)?.[1] ?? '';
}

function extractMcpServer(name: string): string | null {
  const m = name.match(/^mcp__([^_]+(?:_[^_]+)*)__/);
  return m ? m[1] : null;
}

function extractFilePath(input: any): string | null {
  if (!input || typeof input !== 'object') return null;
  const fp = input.file_path ?? input.path ?? input.filePath ?? null;
  return typeof fp === 'string' ? fp : null;
}

function isGitCommitCommand(toolName: string, input: any): boolean {
  if (toolName !== 'Bash' && toolName !== 'PowerShell') return false;
  return /git\s+commit/.test(typeof input?.command === 'string' ? input.command : '');
}

function isGitPushCommand(toolName: string, input: any): boolean {
  if (toolName !== 'Bash' && toolName !== 'PowerShell') return false;
  return /git\s+push/.test(typeof input?.command === 'string' ? input.command : '');
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function attrStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// ---------------------------------------------------------------------------
// Per-file parse
// ---------------------------------------------------------------------------

/**
 * Parse one JSONL file into flat rows.
 *
 * Two behaviours are preserved deliberately from the code this replaces:
 *  - usage rows come from every file; insight rows only from files <= 5 MB
 *    (insights-scan.ts:237-241 has always skipped larger ones)
 *  - cowork transcripts get an empty projectPath, because the path they encode is
 *    sandbox-internal and meaningless on the host
 */
export async function parseFileRows(file: ScannedFile): Promise<FileRows> {
  const { path, source, mtimeMs, size } = file;
  const insightsSkipped = size > INSIGHTS_MAX_FILE_BYTES;

  const rows: FileRows = {
    path, source, mtimeMs, size, insightsSkipped,
    usage: [], toolCalls: [], toolResults: [], taskSpawns: [], sessions: [], corpus: [],
  };

  const projectPath = source === 'cowork' ? '' : projectPathFromFile(path);
  const fileIsSidechain = isSubagentFile(path);
  const parentFromPath = parentSessionFromPath(path);
  const agentId = agentIdFromFileName(path);

  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return rows;
  }

  // Within-file dedup. Cross-file dedup cannot happen here — it belongs in merge.ts.
  const usageByKey = new Map<string, number>(); // dedupKey -> index into rows.usage
  const seenToolIds = new Set<string>();
  const seenTaskIds = new Set<string>();
  const sessions = new Map<string, SessionPartialRow>();
  const corpus = new Map<string, { snippets: string[]; len: number }>();
  const assistantKeys = new Map<string, Set<string>>(); // sessionId -> distinct keys
  let keylessAssistant = 0;

  const sessionRow = (sessionId: string, ts: number, gitBranch: string): SessionPartialRow => {
    let sm = sessions.get(sessionId);
    if (!sm) {
      sm = {
        sessionId, fileIsSidechain, firstTs: ts, lastTs: ts,
        turns: 0, compactions: 0, errorCount: 0, rejectionCount: 0,
        firstPrompt: '', gitBranch, projectPath, file: path, agentId, source,
        assistantKeys: [], gitCommitIds: [], gitPushIds: [], nonErrorResultIds: [],
      };
      sessions.set(sessionId, sm);
    }
    if (ts < sm.firstTs) sm.firstTs = ts;
    if (ts > sm.lastTs) sm.lastTs = ts;
    if (gitBranch && !sm.gitBranch) sm.gitBranch = gitBranch;
    return sm;
  };

  const addCorpus = (sessionId: string, snippet: string) => {
    let c = corpus.get(sessionId);
    if (!c) { c = { snippets: [], len: 0 }; corpus.set(sessionId, c); }
    // The 20 KB per-session cap is applied again globally in merge.ts; keeping it
    // here too bounds memory for a single huge transcript.
    if (c.len < 20 * 1024) { c.snippets.push(snippet); c.len += snippet.length + 1; }
  };

  for (const line of text.split('\n')) {
    if (line.length < 2) continue;

    // Fast path: when only usage rows are wanted, skip lines that cannot be an
    // assistant message without paying for a full parse. Measured 2x on the
    // usage-only corpus. Files that also feed insights need every line parsed.
    if (insightsSkipped && line.indexOf('"assistant"') === -1) continue;

    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    const ts = Date.parse(obj.timestamp ?? '');
    if (Number.isNaN(ts)) continue;

    const sessionId: string = obj.sessionId ?? obj.session_id ?? '';
    const gitBranch: string = typeof obj.gitBranch === 'string' ? obj.gitBranch : '';

    // ---- usage rows (all files) ----
    if (obj.type === 'assistant' && obj.message?.usage) {
      const usage = obj.message.usage;
      const dedupKey = `${obj.requestId ?? ''}:${obj.message?.id ?? ''}`;

      const tools: string[] = [];
      const content = obj.message?.content;
      if (Array.isArray(content)) {
        for (const b of content) {
          if (b?.type === 'tool_use' && typeof b.name === 'string') tools.push(b.name);
        }
      }

      const row: UsageRow = {
        dedupKey, ts, sessionId,
        model: obj.message?.model ?? 'unknown',
        inputTokens: num(usage.input_tokens),
        outputTokens: num(usage.output_tokens),
        cacheCreateTokens: num(usage.cache_creation_input_tokens),
        cacheReadTokens: num(usage.cache_read_input_tokens),
        tools,
        isSidechain: fileIsSidechain || obj.isSidechain === true,
        rootSessionId: fileIsSidechain && parentFromPath ? parentFromPath : sessionId,
        attributionAgent: attrStr(obj.attributionAgent),
        attributionSkill: attrStr(obj.attributionSkill),
        attributionMcpServer: attrStr(obj.attributionMcpServer),
        attributionPlugin: attrStr(obj.attributionPlugin),
        projectPathRaw: source === 'cowork' ? '' : projectPathFromFile(path),
        gitBranch,
        source,
      };

      // Keep-max on effective tokens: early streaming duplicates carry placeholder
      // usage, so first-seen is the wrong winner (see scan.ts:234-236).
      if (dedupKey !== ':') {
        const idx = usageByKey.get(dedupKey);
        if (idx !== undefined) {
          const prev = rows.usage[idx];
          const prevEff = prev.inputTokens + prev.outputTokens + prev.cacheCreateTokens;
          const nextEff = row.inputTokens + row.outputTokens + row.cacheCreateTokens;
          if (nextEff > prevEff) rows.usage[idx] = row;
        } else {
          usageByKey.set(dedupKey, rows.usage.length);
          rows.usage.push(row);
        }
      } else {
        rows.usage.push(row);
      }
    }

    if (insightsSkipped) continue;

    // ---- insight rows (files <= 5 MB only) ----
    const sm = sessionRow(sessionId, ts, gitBranch);

    if (obj.type === 'summary') {
      sm.compactions++;
      continue;
    }

    if (obj.type === 'user' && obj.message?.role === 'user') {
      sm.turns++;
      const content = obj.message.content;

      const handleText = (t: string) => {
        if (/continued from a previous conversation/i.test(t)) sm.compactions++;
        if (!sm.firstPrompt) {
          const trimmed = t.trim();
          if (trimmed && !trimmed.startsWith('<')) sm.firstPrompt = trimmed.slice(0, 200);
        }
        addCorpus(sessionId, t.slice(0, 200));
      };

      if (typeof content === 'string') {
        handleText(content);
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (!block || typeof block !== 'object') continue;

          if (block.type === 'text' && typeof block.text === 'string') handleText(block.text);

          if (block.type === 'tool_result') {
            const toolId: string = block.tool_use_id ?? '';
            const isError: boolean = block.is_error === true;
            const rejected: boolean =
              block.rejected === true ||
              (typeof block.content === 'string' && /reject|doesn't want to proceed|denied/i.test(block.content));

            let errorText = '';
            if (isError) {
              if (typeof block.content === 'string') {
                errorText = block.content.slice(0, 200);
              } else if (Array.isArray(block.content)) {
                const tb = block.content.find((b: any) => b?.type === 'text');
                if (tb?.text) errorText = String(tb.text).slice(0, 200);
              }
            }

            if (isError) sm.errorCount++;
            if (rejected) sm.rejectionCount++;
            if (!isError) sm.nonErrorResultIds.push(toolId);

            let resultText = '';
            if (typeof block.content === 'string') {
              resultText = block.content;
            } else if (Array.isArray(block.content)) {
              for (const tb of block.content) {
                if (tb?.type === 'text' && typeof tb.text === 'string') resultText += tb.text;
              }
            }
            const agentIdMatch = resultText ? resultText.match(/agentId:\s*([a-z0-9]+)/) : null;

            rows.toolResults.push({
              toolId, sessionId, isError, rejected, errorText,
              agentIdFromResult: agentIdMatch ? agentIdMatch[1] : null,
            });
          }
        }
      }
      continue;
    }

    if (obj.type === 'assistant' && obj.message?.role === 'assistant') {
      // assistantMsgs must count distinct message identities, not lines: streaming
      // retries repeat the same message 3x on average. Keyless lines cannot be
      // deduped, so they are counted individually.
      const key = `${obj.requestId ?? ''}:${obj.message?.id ?? ''}`;
      if (key === ':') {
        keylessAssistant++;
      } else {
        let set = assistantKeys.get(sessionId);
        if (!set) { set = new Set(); assistantKeys.set(sessionId, set); }
        set.add(key);
      }

      const content = obj.message?.content;
      if (!Array.isArray(content)) continue;

      for (const block of content) {
        if (!block || block.type !== 'tool_use') continue;
        const toolName: string = block.name ?? '';
        const toolId: string = block.id ?? '';
        const toolInput = block.input ?? {};

        // Dedup by tool_use id, NOT by message key. Only 10,173 of 45,420 distinct
        // tool ids appear on the first line for a key — the earlier lines are
        // streaming placeholders whose content arrives later. Skipping duplicate
        // *messages* would silently drop 78% of tool calls.
        if (toolId && seenToolIds.has(toolId)) continue;
        if (toolId) seenToolIds.add(toolId);

        rows.toolCalls.push({
          toolId, ts, sessionId, name: toolName,
          isSidechain: fileIsSidechain,
          mcpServer: extractMcpServer(toolName),
          filePath: extractFilePath(toolInput),
          gitBranch, projectPath, source,
        });

        if (toolName === 'Agent' || toolName === 'Task') {
          if (!toolId || !seenTaskIds.has(toolId)) {
            if (toolId) seenTaskIds.add(toolId);
            rows.taskSpawns.push({
              toolId, ts, sessionId,
              subagentType: toolInput.subagent_type ?? toolInput.agentType ?? 'unknown',
              model: toolInput.model ?? null,
              description: String(toolInput.description ?? '').slice(0, 200),
              gitBranch, projectPath, source,
            });
          }
        }

        if (isGitCommitCommand(toolName, toolInput)) sm.gitCommitIds.push(toolId);
        if (isGitPushCommand(toolName, toolInput)) sm.gitPushIds.push(toolId);
      }
    }
  }

  for (const [sessionId, set] of assistantKeys) {
    const sm = sessions.get(sessionId);
    if (sm) sm.assistantKeys = [...set];
  }
  // Attribute keyless assistant lines to the file's first session so the count is
  // preserved without pretending they have an identity.
  if (keylessAssistant > 0) {
    const first = sessions.values().next().value;
    if (first) {
      for (let i = 0; i < keylessAssistant; i++) first.assistantKeys.push(` keyless:${path}:${i}`);
    }
  }

  rows.sessions = [...sessions.values()];
  rows.corpus = [...corpus.entries()].map(([sessionId, c]) => ({ sessionId, snippets: c.snippets }));
  return rows;
}

/** Parse many files with bounded concurrency, preserving input order in the output. */
export async function parseFiles(files: ScannedFile[]): Promise<FileRows[]> {
  const out = new Array<FileRows>(files.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(PARSE_CONCURRENCY, files.length) }, async () => {
    while (next < files.length) {
      const i = next++;
      out[i] = await parseFileRows(files[i]);
    }
  });
  await Promise.all(workers);
  return out;
}
