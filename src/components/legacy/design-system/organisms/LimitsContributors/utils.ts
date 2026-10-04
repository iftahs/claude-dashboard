import type { ContribBreakdownKey, ContribWindowKey } from './types';

export const RANGE_OPTIONS: { value: ContribWindowKey; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
];

export const BREAKDOWNS: { key: ContribBreakdownKey; label: string; color: string }[] = [
  { key: 'skills', label: 'Skills', color: '#f59e0b' },
  { key: 'subagents', label: 'Subagents', color: '#a78bfa' },
  { key: 'plugins', label: 'Plugins', color: '#22d3ee' },
  { key: 'mcpServers', label: 'MCP servers', color: '#10b981' },
];

export const CLAUDE_HELP =
  'Approximate, cost-weighted breakdown computed from local sessions on this machine — does not include other devices or claude.ai. These are independent characteristics of your usage, not a breakdown. Mirrors the Claude Code CLI usage view.';

export const CODEX_HELP =
  "Approximate breakdown of your Codex usage, weighted by effective tokens (Guardian auto-reviews are priced at $0, so a cost weighting would hide them), computed from local rollouts on this machine — does not include the ChatGPT mobile or web apps. These are independent characteristics of your usage, not a breakdown.";

/** Codex agent kinds → readable names; anything else passes through. */
const AGENT_NAMES: Record<string, string> = {
  guardian_review: 'Guardian auto-review',
};

export function agentName(name: string): string {
  return AGENT_NAMES[name] ?? name;
}
