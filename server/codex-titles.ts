/**
 * codex-titles.ts — Codex thread titles from `<codexDir>/session_index.jsonl`.
 *
 * Append-only; the desktop app appends `{id, thread_name, updated_at}` on every
 * (re)name, so the LAST entry per id wins. Rollouts carry no title themselves.
 * Read-only, fail-soft, and cheap — re-read only when the file's size/mtime changes.
 */
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { codexDir } from './scan.ts';

/** How often the file is re-stat'ed; a poll between checks reuses the last answer. */
const CHECK_MS = 5_000;
/** Titles longer than this are cut — they are labels, not content. */
const MAX_TITLE = 200;

/** thread id (lower-cased) → latest thread name. Junk lines and empty names are skipped. */
export function parseSessionIndex(text: string): Map<string, string> {
  const titles = new Map<string, string>();
  // Split on '\n' only (U+2028/2029 are legal inside JSON strings).
  for (const line of text.split('\n')) {
    if (line.length < 2) continue;
    let o: any;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const id = typeof o?.id === 'string' ? o.id.trim().toLowerCase() : '';
    const name = typeof o?.thread_name === 'string' ? o.thread_name.trim() : '';
    if (!id || !name) continue;
    titles.delete(id); // re-insert so iteration order follows the latest rename
    titles.set(id, name.slice(0, MAX_TITLE));
  }
  return titles;
}

let cache: { key: string; titles: Map<string, string>; checkedAt: number } | null = null;
let inFlight: Promise<Map<string, string>> | null = null;

async function load(): Promise<Map<string, string>> {
  const file = join(codexDir(), 'session_index.jsonl');
  let key: string;
  try {
    const s = await stat(file);
    key = `${file}|${s.size}|${s.mtimeMs}`;
  } catch {
    cache = { key: '', titles: new Map(), checkedAt: Date.now() };
    return cache.titles;
  }
  if (cache && cache.key === key) {
    cache.checkedAt = Date.now();
    return cache.titles;
  }
  let titles = new Map<string, string>();
  try {
    titles = parseSessionIndex(await readFile(file, 'utf8'));
  } catch {
    /* unreadable right now — keep an empty map until the next change */
  }
  cache = { key, titles, checkedAt: Date.now() };
  return titles;
}

/** Codex thread titles keyed by lower-cased thread id. Never throws. */
export async function readCodexTitles(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.checkedAt < CHECK_MS) return cache.titles;
  if (!inFlight) inFlight = load().finally(() => { inFlight = null; });
  return inFlight;
}

/** The title of one Codex thread, if the index names it. */
export function codexTitleOf(titles: Map<string, string>, threadId: string): string | undefined {
  return titles.get(threadId.toLowerCase());
}
