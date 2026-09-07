import { codexProjectLabel } from '@/lib/project';
import type { LiveSubagents } from '@/types';
import type { AgentActivityLabels } from './types';

/** Elapsed seconds since a unix-ms timestamp */
export function elapsedSec(startedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

/** Format elapsed seconds as "1m 23s" or "45s" */
export function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

/** Strip claude- prefix and date suffix for display */
export function displayModel(model: string): string {
  if (!model || model === 'inherit') return 'inherit';
  return model
    .replace(/^claude-/, '')
    .replace(/-\d{8}$/, '')
    .replace(/-(\d)-(\d)$/, ' $1.$2')
    .replace(/-(\d)$/, ' $1'); // single-digit generations: opus-5 → "opus 5"
}

// ── Codex (ChatGPT desktop) ────────────────────────────────────────────────
// The same organism renders the Codex threads and their Guardian auto-reviews;
// only the wording and one field of the payload differ.

/** Section title for the Codex feed. */
export const CODEX_AGENT_TITLE = 'Codex agents · live activity';

/** Section title for the Claude feed when both platforms are stacked. */
export const CLAUDE_AGENT_TITLE = 'Claude agents · live activity';

export const CODEX_AGENTS_HELP =
  'Live view of Codex threads working right now in the ChatGPT desktop app, with the Guardian auto-review subagents each turn spawns nested beneath, plus recently finished reviews — refreshed every few seconds from the local rollout files. Empty when nothing is running.';

export const CODEX_AGENT_LABELS: AgentActivityLabels = {
  mains: 'Codex threads',
  subagents: 'Guardian reviews',
  otherSubagents: 'Other guardian reviews',
  subagentUnit: ['review', 'reviews'],
  mainUnit: ['thread', 'threads'],
  empty: 'No Codex threads running right now',
};

/**
 * The Codex agents endpoint carries each thread's *full* cwd in `project` (the
 * Claude Code one already ships a display name). AgentActivity renders `project`
 * verbatim, so shorten it to the last segment — or "Codex chat · <slug>" for the
 * desktop app's scratch folders — before it reaches the screen.
 */
export function toDisplayAgents(data: LiveSubagents | null): LiveSubagents | null {
  if (!data) return null;
  return {
    ...data,
    mainAgents: data.mainAgents.map((m) => ({ ...m, project: codexProjectLabel(m.project) })),
    running: data.running.map((r) => ({ ...r, project: codexProjectLabel(r.project) })),
    recentlyCompleted: data.recentlyCompleted.map((r) => ({ ...r, project: codexProjectLabel(r.project) })),
  };
}
