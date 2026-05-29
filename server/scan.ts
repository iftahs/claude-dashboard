import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

export interface UsageEvent {
  ts: number; // epoch ms
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  tools: string[]; // tool_use names invoked in this assistant message
}

export function claudeDir(): string {
  return process.env.CLAUDE_DIR || join(homedir(), '.claude');
}

function projectsDir(): string {
  return join(claudeDir(), 'projects');
}

async function listJsonl(dir: string): Promise<string[]> {
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
      entries = entries.concat(await listJsonl(full));
    } else if (d.isFile() && d.name.endsWith('.jsonl')) {
      entries.push(full);
    }
  }
  return entries;
}

/** Newest mtime across all jsonl files — used as a cheap cache-invalidation signal. */
export async function projectsFingerprint(): Promise<number> {
  const files = await listJsonl(projectsDir());
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

async function parseFile(file: string, seen: Set<string>, out: UsageEvent[]): Promise<void> {
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

    // Dedup: same logical response can appear multiple times (retries/streaming).
    const key = `${obj.requestId ?? ''}:${obj.message?.id ?? ''}`;
    if (key !== ':' && seen.has(key)) continue;
    if (key !== ':') seen.add(key);

    const ts = Date.parse(obj.timestamp);
    if (Number.isNaN(ts)) continue;

    const tools: string[] = [];
    const content = obj.message?.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === 'tool_use' && typeof block.name === 'string') tools.push(block.name);
      }
    }

    out.push({
      ts,
      sessionId: obj.sessionId ?? obj.session_id ?? '',
      model: obj.message?.model ?? 'unknown',
      inputTokens: num(usage.input_tokens),
      outputTokens: num(usage.output_tokens),
      cacheCreateTokens: num(usage.cache_creation_input_tokens),
      cacheReadTokens: num(usage.cache_read_input_tokens),
      tools,
    });
  }
}

/** Scan all session JSONL, dedup, return events sorted ascending by time. */
export async function scanEvents(): Promise<UsageEvent[]> {
  const files = await listJsonl(projectsDir());
  const seen = new Set<string>();
  const out: UsageEvent[] = [];
  for (const f of files) {
    await parseFile(f, seen, out);
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
}
