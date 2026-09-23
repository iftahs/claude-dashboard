/**
 * project-path.ts — the one derivation of a session's project path.
 *
 * Claude Code files every transcript under `projects/<encoded cwd>/`, where the
 * encoding replaces every non-alphanumeric character with '-'. Decoding that
 * folder name is lossy: `E:\dev-projects\iftah.dev` and `E:\dev-projects-iftah-dev`
 * both encode to `E--dev-projects-iftah-dev`, and the decoder can only guess the
 * second. Codex, meanwhile, records the real cwd — so under *Both* the same repo
 * showed up as two projects, and tags, costs and rollups never met.
 *
 * Every Claude Code transcript line also carries the real `cwd`. That is now the
 * source of truth (merge.ts for events/sessions/tool rows, workflows.ts and
 * subagents-live.ts for live runs); the folder decode is only the fallback, and it
 * stays exported because the tags the UI stored before this change are keyed by it.
 *
 * Cowork is untouched: its cwd is a path inside the sandbox and stays blank.
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

/**
 * A real project path in the one form every surface shares: Windows drive paths
 * with backslashes and a lower-case drive letter (what the folder decoder and the
 * Codex parser produce), no trailing separator, and a Claude Code worktree folded
 * into the repo it was checked out from — it is the same project, and its
 * throwaway folder name would otherwise show up as a project of its own.
 */
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

/**
 * The main session transcript of a file under `…/projects/<enc>/<session>/…`
 * (a subagent transcript, a workflow journal, …): `…/projects/<enc>/<session>.jsonl`.
 * A file directly in `projects/<enc>/` is its own session transcript. null when the
 * path has no `projects/<enc>` segment.
 */
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

/**
 * The first `cwd` recorded in a Claude Code transcript — the directory the
 * session started in, which a session never changes. Cached per path, including
 * the empty answer for a transcript with none; a missing file is not cached, so
 * it resolves once the transcript appears.
 */
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

/**
 * The project path for any Claude Code file under `…/projects/<enc>/<session>/…`:
 * the session transcript's cwd, else the file's own first cwd (a subagent
 * transcript carries one), else the legacy folder decode. Same result as
 * merge.ts derives for the session's events, so live panels and history agree.
 */
export async function projectPathForFile(file: string): Promise<string> {
  const transcript = sessionTranscriptFor(file);
  let cwd = transcript ? await transcriptCwd(transcript) : '';
  if (!cwd && file.endsWith('.jsonl') && file !== transcript) cwd = await transcriptCwd(file);
  return claudeProjectPath(cwd, file);
}
