/**
 * history.ts — slash-command / skill usage from ~/.claude/history.jsonl.
 * Each line: {display, pastedContents, timestamp, project, sessionId}.
 * Only lines whose `display` starts with "/" are counted (typed prompts ignored).
 * 30s TTL cache.
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { claudeDir } from './scan.ts';

export interface CommandUsageData {
  totalCommands: number;
  uniqueCommands: number;
  commands: { command: string; count: number }[];
}

const DAY_MS = 24 * 3600_000;
const TTL = 30_000;
let cache: { key: string; data: CommandUsageData } | null = null;

export async function getCommandUsage(days: number, now = Date.now()): Promise<CommandUsageData> {
  const key = `${days}:${Math.floor(now / TTL)}`;
  if (cache && cache.key === key) return cache.data;

  const from = now - days * DAY_MS;
  const file = join(claudeDir(), 'history.jsonl');
  const counts = new Map<string, number>();
  let total = 0;

  try {
    const s = await stat(file);
    if (s.size <= 20 * 1024 * 1024) {
      const rl = createInterface({ input: createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
      for await (const line of rl) {
        if (!line || line.length < 2) continue;
        let obj: any;
        try {
          obj = JSON.parse(line);
        } catch {
          continue;
        }
        const ts = typeof obj.timestamp === 'number' ? obj.timestamp : Date.parse(obj.timestamp ?? '');
        if (Number.isNaN(ts) || ts < from) continue;
        const display = typeof obj.display === 'string' ? obj.display.trim() : '';
        const m = display.match(/^(\/[a-zA-Z0-9:_-]+)/);
        if (!m) continue;
        const cmd = m[1];
        counts.set(cmd, (counts.get(cmd) ?? 0) + 1);
        total++;
      }
    }
  } catch {
    /* no history file */
  }

  const commands = [...counts.entries()]
    .map(([command, count]) => ({ command, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  const data: CommandUsageData = { totalCommands: total, uniqueCommands: counts.size, commands };
  cache = { key, data };
  return data;
}
