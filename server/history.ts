/**
 * history.ts — slash-command and skill usage for the Insights "Commands" panel.
 *
 * Two sources, one list:
 *  - SLASH COMMANDS from ~/.claude/history.jsonl (Claude Code's prompt history).
 *    Each line: {display, pastedContents, timestamp, project, sessionId}; only lines
 *    whose `display` starts with "/" count. The file is the CLI's, so a line takes
 *    the surface of its session (from the usage events) and defaults to 'code' when
 *    that session left no usage; a Codex scope therefore never sees one.
 *  - SKILLS from the per-request `attributionSkill` tag Claude Code writes on each
 *    assistant message. One skill run spans many requests, so a skill counts once
 *    per session that ran it — never once per request.
 * Codex records neither (its desktop app logs no slash commands, and a skill load
 * is only a file read inside a shell command), so a Codex scope comes back empty.
 *
 * The file is split on '\n', never with readline: readline treats U+2028/U+2029 as
 * line breaks, and both are legal inside the JSON strings of a typed prompt.
 */

import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { claudeDir, type UsageEvent, type UsageSource } from './scan.ts';
import { sourceMatches, type SourceFilter } from './aggregate.ts';
import { getEvents, eventsFingerprint } from './cache.ts';

export type CommandKind = 'slash' | 'skill';

export interface CommandUsageData {
  /** Slash-command invocations + skill sessions. */
  totalCommands: number;
  uniqueCommands: number;
  /** Slash commands count invocations; skills count sessions that ran the skill. */
  commands: { command: string; count: number; kind: CommandKind }[];
  slashCommands: number;
  skillSessions: number;
}

/** One slash command typed at the CLI prompt. */
export interface SlashEntry {
  ts: number;
  command: string;
  sessionId: string;
}

const DAY_MS = 24 * 3600_000;
const MAX_HISTORY_BYTES = 20 * 1024 * 1024;
const COMMAND_RE = /^(\/[a-zA-Z0-9:_-]+)/;

/** Slash entries from history.jsonl text (pure — split on '\n'). */
export function parseSlashHistory(text: string): SlashEntry[] {
  const out: SlashEntry[] = [];
  for (const line of text.split('\n')) {
    if (line.length < 2) continue;
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const ts = typeof obj?.timestamp === 'number' ? obj.timestamp : Date.parse(obj?.timestamp ?? '');
    if (!Number.isFinite(ts)) continue;
    const display = typeof obj.display === 'string' ? obj.display.trim() : '';
    const m = display.match(COMMAND_RE);
    if (!m) continue;
    out.push({ ts, command: m[1], sessionId: typeof obj.sessionId === 'string' ? obj.sessionId : '' });
  }
  return out;
}

export interface CommandUsageInput {
  slash: SlashEntry[];
  events: UsageEvent[];
  source: SourceFilter;
  days: number;
  now: number;
  limit?: number;
}

export function buildCommandUsage({ slash, events, source, days, now, limit = 25 }: CommandUsageInput): CommandUsageData {
  const from = now - days * DAY_MS;

  // Session → surface, from the events (a history line only carries its sessionId).
  const sessionSource = new Map<string, UsageSource>();
  for (const e of events) if (e.sessionId && !sessionSource.has(e.sessionId)) sessionSource.set(e.sessionId, e.source);

  const slashCounts = new Map<string, number>();
  let slashCommands = 0;
  for (const s of slash) {
    if (s.ts < from) continue;
    if (!sourceMatches(sessionSource.get(s.sessionId) ?? 'code', source)) continue;
    slashCounts.set(s.command, (slashCounts.get(s.command) ?? 0) + 1);
    slashCommands++;
  }

  const skillRuns = new Map<string, Set<string>>(); // skill → sessions that ran it
  for (const e of events) {
    if (e.ts < from || !e.attributionSkill) continue;
    if (!sourceMatches(e.source, source)) continue;
    let set = skillRuns.get(e.attributionSkill);
    if (!set) { set = new Set(); skillRuns.set(e.attributionSkill, set); }
    set.add(e.rootSessionId || e.sessionId);
  }
  let skillSessions = 0;
  for (const set of skillRuns.values()) skillSessions += set.size;

  const commands = [
    ...[...slashCounts].map(([command, count]) => ({ command, count, kind: 'slash' as const })),
    ...[...skillRuns].map(([command, set]) => ({ command, count: set.size, kind: 'skill' as const })),
  ]
    .sort((a, b) => b.count - a.count || a.command.localeCompare(b.command))
    .slice(0, limit);

  return {
    totalCommands: slashCommands + skillSessions,
    uniqueCommands: slashCounts.size + skillRuns.size,
    commands,
    slashCommands,
    skillSessions,
  };
}

// ---------------------------------------------------------------------------
// I/O: history.jsonl, re-read only when it changes
// ---------------------------------------------------------------------------

let historyCache: { sig: string; entries: SlashEntry[] } | null = null;

/** Slash entries plus a signature of the file version they came from ('' when absent). */
export async function readSlashHistory(): Promise<{ sig: string; entries: SlashEntry[] }> {
  const file = join(claudeDir(), 'history.jsonl');
  try {
    const s = await stat(file);
    const sig = `${s.mtimeMs}:${s.size}`;
    if (historyCache && historyCache.sig === sig) return historyCache;
    const entries = s.size <= MAX_HISTORY_BYTES ? parseSlashHistory(await readFile(file, 'utf8')) : [];
    historyCache = { sig, entries };
    return historyCache;
  } catch {
    return { sig: '', entries: [] }; // no history file
  }
}

/** (days, source) → the last result, valid while the events and the history file are unchanged. */
const usageMemo = new Map<string, { token: string; data: CommandUsageData }>();

/**
 * Command usage for a window and scope, on the scan's clock unless `now` is given.
 * Recomputed only when the events (their fingerprint folds in the minute) or the
 * history file change.
 */
export async function getCommandUsage(
  days: number,
  now?: number,
  source: SourceFilter = 'all',
): Promise<CommandUsageData> {
  const { events, computedAt } = await getEvents();
  const at = now ?? computedAt;
  const history = await readSlashHistory();
  const key = `${days}|${source}`;
  const token = `${eventsFingerprint()}|${history.sig}|${Math.floor(at / 60_000)}`;
  const hit = usageMemo.get(key);
  if (hit && hit.token === token) return hit.data;
  const data = buildCommandUsage({ slash: history.entries, events, source, days, now: at });
  usageMemo.set(key, { token, data });
  return data;
}
