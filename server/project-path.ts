/**
 * project-path.ts — the one derivation of a session's project path.
 *
 * Claude Code files every transcript under `projects/<encoded cwd>/`, replacing
 * every non-alphanumeric char with '-' — a lossy encoding (`E:\dev-projects\iftah.dev`
 * and `E:\dev-projects-iftah-dev` both encode the same way, so decoding can only guess).
 *
 * Every transcript line also carries the real `cwd`, which is now the source of
 * truth (merge.ts, workflows.ts, subagents-live.ts); the folder decode stays only
 * as the fallback, exported because older UI tags are keyed by it.
 *
 * Cowork is untouched: its cwd is a sandbox-internal path and stays blank.
 */
import { open } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Lossy decode of a `projects/<encoded>` folder name (the pre-cwd derivation). */
export function decodeProjectDir(encoded: string): string {
  if (/^[A-Za-z]--/.test(encoded)) {
    const letter = encoded[0].toLowerCase();
    const rest = encoded.slice(3).replace(/--/g, '\\');
    return `${letter}:\\${rest}`;
  }
  return '/' + encoded.replace(/--/g, '/');
}

/** The legacy decoded project path of any file under `…/projects/<encoded>/…`; '' when there is none. */
export function legacyProjectPathFromFile(file: string): string {
  try {
    const parts = file.replace(/\\/g, '/').split('/');
    const projIdx = parts.lastIndexOf('projects');
    if (projIdx !== -1 && parts[projIdx + 1]) {
      const seg = parts[projIdx + 1];
      // The session transcript itself sits directly in projects/<encoded>/.
      if (projIdx + 2 < parts.length || !seg.endsWith('.jsonl')) return decodeProjectDir(decodeURIComponent(seg));
    }
  } catch {
    /* malformed URI escape — no path */
  }
  return '';
}

/** Claude Code's `--worktree` checkouts: `<repo>/.claude/worktrees/<name>[/…]`. */
const WORKTREE_RE = /^(.+?)[\\/]\.claude[\\/]worktrees[\\/][^\\/]+(?:[\\/].*)?$/;

/** Canonical form every surface shares: lower-case drive letter, backslashes, no trailing separator, and a Claude Code worktree folded into its repo (else its throwaway folder name would be its own project). */
export function normalizeProjectPath(p: string): string {
  if (!p) return '';
  let out = p.trim();
  if (/^[A-Za-z]:[\\/]/.test(out) || /^[A-Za-z]:$/.test(out)) {
    out = out.replace(/\//g, '\\');
    out = out[0].toLowerCase() + out.slice(1);
  }
  const wt = WORKTREE_RE.exec(out);
  if (wt) out = wt[1];
  // Strip trailing separators, but keep a bare root ("c:\", "/").
  while (out.length > 1 && /[\\/]$/.test(out) && !/^[a-z]:\\$/.test(out)) out = out.slice(0, -1);
  return out;
}

/** A Claude Code (not Cowork) project path: the transcript's cwd, else the legacy folder decode. */
export function claudeProjectPath(cwd: string | undefined | null, file: string): string {
  return (cwd && normalizeProjectPath(cwd)) || legacyProjectPathFromFile(file);
}

/** Last path segment ("e:\\dev\\my-app" → "my-app"). */
export function projectNameOf(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

const CWD_RE = /"cwd":"((?:[^"\\]|\\.)*)"/;

/** The first `"cwd":"…"` value in a chunk of transcript JSONL, unescaped; '' when absent. */
export function firstCwdIn(text: string): string {
  const m = CWD_RE.exec(text);
  if (!m) return '';
  try {
    const v = JSON.parse(`"${m[1]}"`);
    return typeof v === 'string' ? v : '';
  } catch {
    return '';
  }
}

/** The main session transcript of a file under `…/projects/<enc>/<session>/…`; null when the path has no `projects/<enc>` segment. */
export function sessionTranscriptFor(file: string): string | null {
  // Greedy prefix: the LAST `projects` segment, like the folder decoder.
  const m = /^(.*[\\/]projects[\\/][^\\/]+)([\\/])([^\\/]+)/.exec(file);
  if (!m) return null;
  const [, base, sep, sessionSeg] = m;
  return sessionSeg.endsWith('.jsonl') ? `${base}${sep}${sessionSeg}` : `${base}${sep}${sessionSeg}.jsonl`;
}

// ---------------------------------------------------------------------------
// Live lookups (workflows.ts, subagents-live.ts): read a transcript's first cwd
// ---------------------------------------------------------------------------

/** How much of a transcript is searched for its first cwd (a few lines in practice). */
const HEAD_BYTES = 256 * 1024;
const CHUNK = 64 * 1024;
const CWD_CACHE_MAX = 4096;
const cwdCache = new Map<string, string>();

/** The first `cwd` recorded in a transcript (a session never changes it). Cached per path, including the empty answer; a missing file is not cached, so it resolves once it appears. */
export async function transcriptCwd(file: string): Promise<string> {
  const hit = cwdCache.get(file);
  if (hit !== undefined) return hit;
  let fh;
  try {
    fh = await open(file, 'r');
  } catch {
    return '';
  }
  let cwd = '';
  try {
    const buf = Buffer.alloc(CHUNK);
    let text = '';
    let pos = 0;
    while (pos < HEAD_BYTES) {
      const { bytesRead } = await fh.read(buf, 0, CHUNK, pos);
      if (bytesRead <= 0) break;
      pos += bytesRead;
      text += buf.toString('utf8', 0, bytesRead);
      cwd = firstCwdIn(text);
      if (cwd) break;
    }
  } catch {
    /* unreadable — fall back */
  } finally {
    await fh.close().catch(() => {});
  }
  if (cwdCache.size >= CWD_CACHE_MAX) {
    const oldest = cwdCache.keys().next().value;
    if (oldest !== undefined) cwdCache.delete(oldest);
  }
  cwdCache.set(file, cwd);
  return cwd;
}

/** The session transcript's cwd, else the file's own first cwd, else the legacy folder decode — same result merge.ts derives, so live panels and history agree. */
export async function projectPathForFile(file: string): Promise<string> {
  const transcript = sessionTranscriptFor(file);
  let cwd = transcript ? await transcriptCwd(transcript) : '';
  if (!cwd && file.endsWith('.jsonl') && file !== transcript) cwd = await transcriptCwd(file);
  return claudeProjectPath(cwd, file);
}
