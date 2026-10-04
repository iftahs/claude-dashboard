import { codexProjectLabel } from '@/lib/project';
import type { MainAgent } from '@/types';
import type { AgentActivityLabels, LiveAgentsData, LiveMainAgent } from './types';

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

// The Claude strings are the defaults so a Claude-only dashboard reads exactly as before.

/** Section title (the platform suffix is added by the Agents tab). */
export const AGENT_TITLE = 'Agents · live activity';

const YOUR_TURN_NOTE =
  'shows as “your turn” for up to 5 minutes — a soft state, never an alert.';

export const CLAUDE_AGENTS_HELP = `Live view of agents working right now: main sessions, their running subagents (Task/Agent spawns and Workflow agents), and recently finished ones — refreshed every few seconds from active session logs. A session whose turn just finished ${YOUR_TURN_NOTE} Empty when nothing is running.`;

export const CODEX_AGENTS_HELP = `Live view of Codex threads working right now in the ChatGPT desktop app, with the subagents each turn spawns — Guardian auto-reviews and delegated agents — nested beneath, plus recently finished ones; refreshed every few seconds from the local rollout files. A thread whose turn just finished ${YOUR_TURN_NOTE} Empty when nothing is running.`;

export const CLAUDE_AGENT_LABELS: Required<AgentActivityLabels> = {
  mains: 'Main sessions',
  subagents: 'Subagents',
  otherSubagents: 'Other subagents',
  subagentUnit: ['subagent', 'subagents'],
  mainUnit: ['main', 'mains'],
  empty: 'No agents running right now',
  waitingHelp:
    'A session paused on something only you can resolve: an unresolved tool call (likely a permission prompt), a tool call you rejected, or a turn that ended in an API error or usage limit. This is inferred — the logs have no explicit “waiting for confirmation” marker — so it may occasionally over- or under-count.',
  yourTurnHelp:
    'Sessions whose last turn finished normally: the agent is idle, ready for your next prompt. Listed for up to 5 minutes; never red, never an alert.',
};

export const CODEX_AGENT_LABELS: Required<AgentActivityLabels> = {
  mains: 'Codex threads',
  subagents: 'Subagents',
  otherSubagents: 'Other subagents',
  subagentUnit: ['subagent', 'subagents'],
  mainUnit: ['thread', 'threads'],
  empty: 'No Codex threads running right now',
  waitingHelp:
    'A thread paused on something only you can resolve: an approval request (a tool call with no result yet under the “on-request” approval policy, reviewed by you rather than the Guardian), an action you declined, or a turn that failed (e.g. at the usage limit). This is inferred — rollouts have no explicit “awaiting approval” record — so it may occasionally over- or under-count.',
  yourTurnHelp:
    'Threads whose last turn finished normally: Codex is idle, ready for your next prompt. Listed for up to 5 minutes; never red, never an alert.',
};
