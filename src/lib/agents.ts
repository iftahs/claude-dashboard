import { codexProjectLabel } from './project';
import type { LiveSubagents, MainAgent } from '@/types';

/** Optional fields, so an older backend still type-checks and simply never shows "your turn". */
export interface LiveMainAgent extends MainAgent {
  /** The last turn finished and the session is idle on the user — soft, never red, never an alert. */
  yourTurn?: boolean;
}

export interface LiveAgentsData extends Omit<LiveSubagents, 'mainAgents' | 'counts'> {
  mainAgents: LiveMainAgent[];
  counts: LiveSubagents['counts'] & { yourTurn?: number };
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

/** Whether a main session is idle on the user after a finished turn (the soft "your turn" state). */
export function isYourTurn(m: MainAgent | LiveMainAgent): boolean {
  return (m as LiveMainAgent).yourTurn === true;
}

// Matches the Claude desktop scratch-workspace path, e.g. `.../Claude/scratch-workspaces/<acct>/<profile>/scratch-<date>-<id>`.
const CLAUDE_SCRATCH_DIR = /[\\/]Claude[\\/]scratch-workspaces[\\/](?:[^\\/]+[\\/])*([^\\/]+)[\\/]?$/i;
// A git worktree Claude Code created: `<repo>/.claude/worktrees/<name>`.
const CLAUDE_WORKTREE_DIR = /([^\\/]+)[\\/]\.claude[\\/]worktrees[\\/]([^\\/]+)[\\/]?$/;

export function agentProjectLabel(path: string): string {
  if (!path) return '';
  const scratch = path.match(CLAUDE_SCRATCH_DIR);
  if (scratch) return `Claude chat · ${scratch[1].replace(/^scratch-/, '')}`;
  const worktree = path.match(CLAUDE_WORKTREE_DIR);
  if (worktree) return `${worktree[1]} (${worktree[2]})`;
  return codexProjectLabel(path); // "Codex chat · <slug>", else the last path segment
}

// Runs once per poll result, not per render — remapping on every render would churn the card animations.
export function toDisplayAgents(data: LiveAgentsData | null): LiveAgentsData | null {
  if (!data) return null;
  return {
    ...data,
    mainAgents: data.mainAgents.map((m) => ({ ...m, project: agentProjectLabel(m.project) })),
    running: data.running.map((r) => ({ ...r, project: agentProjectLabel(r.project) })),
    recentlyCompleted: data.recentlyCompleted.map((r) => ({ ...r, project: agentProjectLabel(r.project) })),
  };
}
