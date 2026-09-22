/**
 * Project display names derived from filesystem paths. Shared by the Sessions
 * table and the Codex tab so both surfaces label a thread's working directory
 * the same way. Only the last path segment ever reaches the screen — never the
 * full path.
 */

/** Last path segment of a project path ("C:\\dev\\my-app" → "my-app"). */
export function projectName(path: string): string {
  if (!path) return 'unknown';
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

// The ChatGPT desktop app gives each chat-only Codex thread a scratch folder,
// `…/Documents/Codex/<date>/<slug>` — the slug is the only meaningful part.
const CODEX_CHAT_DIR = /[\\/]Documents[\\/]Codex[\\/][^\\/]+[\\/]([^\\/]+)[\\/]?$/i;

/** Project label for a Codex thread: "Codex chat · <slug>" for the desktop
 *  scratch folders, otherwise the ordinary last-segment project name. */
export function codexProjectLabel(path: string): string {
  const m = path?.match(CODEX_CHAT_DIR);
  return m ? `Codex chat · ${m[1]}` : projectName(path);
}
