import type { ReactNode } from 'react';

/** Group/chip strings. Defaults are the Claude Code wording used by the Agents tab. */
export interface AgentActivityLabels {
  /** Group label above the top-level sessions. Default: "Main sessions". */
  mains?: string;
  /** Group label above a session's nested subagents. Default: "Subagents". */
  subagents?: string;
  /** Group label for subagents whose parent session is not shown. Default: "Other subagents". */
  otherSubagents?: string;
  /** Header chip unit for running subagents, singular/plural. Default: subagent/subagents. */
  subagentUnit?: [string, string];
  /** Header chip unit for active top-level sessions, singular/plural. Default: main/mains. */
  mainUnit?: [string, string];
  /** Empty-state line. Default: "No agents running right now". */
  empty?: string;
  waitingHelp?: ReactNode;
  yourTurnHelp?: ReactNode;
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

/** The Agents tab's history window. /api/insights/subagents clamps days to 1–90. */
export const AGENT_HISTORY_DAYS = 30;

export type HistoryUnit = 'session' | 'thread';

export function historyUnit(platform: 'claude' | 'codex'): HistoryUnit {
  return platform === 'codex' ? 'thread' : 'session';
}

/** InfoTip copy per platform — what a "spawn" is differs, the stats do not. */
export function historyHelp(platform: 'claude' | 'codex', days: number): string {
  const what =
    platform === 'codex'
      ? `Subagent threads Codex spawned over the last ${days} days — one Guardian auto-review per approval verdict, plus delegated agents`
      : `Subagents Claude Code spawned (Agent/Task calls) over the last ${days} days`;
  const unit = historyUnit(platform);
  return `${what}: how many, how many per ${unit} that delegated, the share of ${unit}s that delegated at all, and which types did the work.`;
}
