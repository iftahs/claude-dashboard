import type { Platform } from '@/hooks/useSource';

/** `?source=` for the workspace routes: one platform, or both merged (`all`). Always explicit. */
export function workspaceSource(platform: Platform): 'claude' | 'codex' | 'all' {
  return platform === 'both' ? 'all' : platform;
}

export const INVENTORY_HELP: Record<Platform, string> = {
  claude:
    'Installed plugins, registered MCP servers (global vs project-scoped), plugin marketplaces, your skills and any configured hooks — your local Claude Code integration inventory.',
  codex:
    'Plugins from config.toml (turned-off ones dimmed), marketplaces, MCP servers (name and launch program only — never their env vars or args), the notify hook, your skills (bundled ones marked) and scheduled automations — your local Codex integration inventory.',
  both:
    "Both platforms' integrations in one inventory, each item tagged Claude or Codex: plugins, MCP servers, marketplaces, skills, hooks and Codex's scheduled automations.",
};

export const TASKS_HELP: Record<Platform, string> = {
  claude:
    "Tasks tracked by Claude Code's task tooling (completion + blocked) and the plan documents under ~/.claude/plans, with size and age.",
  codex:
    'The plans Codex saved from its planning turns (plans/ in the Codex data folder), with size and age. Codex keeps no task list, so the task side stays empty.',
  both:
    'Claude Code tasks (completion + blocked) and the plans both platforms saved, each plan tagged with its platform, with size and age.',
};

/** Tasks-column empty state: Codex has no task tracker at all, so say so instead of "none tracked". */
export const EMPTY_TASKS: Record<Platform, string> = {
  claude: 'No tasks tracked.',
  codex: 'Codex keeps no task list — its plans are on the right.',
  both: 'No tasks tracked.',
};
