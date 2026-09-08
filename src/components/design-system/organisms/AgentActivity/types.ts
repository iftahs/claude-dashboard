import type { ReactNode } from 'react';
import type { LiveSubagents } from '@/types';

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
}

export interface AgentActivityProps {
  data: LiveSubagents | null;
  loading?: boolean;
  /** Section title. Default: "Agents · live activity". */
  title?: string;
  /** Section InfoTip text. Defaults to the Claude Code explanation. */
  help?: ReactNode;
  /** Group and chip wording. Defaults to the Claude Code strings. */
  labels?: AgentActivityLabels;
}
