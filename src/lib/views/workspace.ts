import { PLATFORM_NOUN, type Platform } from '@/lib/platform';
import type { SectionAi, SectionState } from '@/lib/section';
import type {
  ClaudeConfig,
  CodexConfigData,
  CodexLiveData,
  InventoryData,
  WorkspacePlatform,
  WorkspaceTasksData,
} from '@/types';

export type WorkspaceTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export interface ProfileFactView {
  label: string;
  value: string;
  title: string;
  help: string | null;
  capitalize: boolean;
}

export interface ProfileFlagView {
  label: string;
  value: string;
  tone: WorkspaceTone;
}

export interface ProfileListView {
  title: string;
  count: number;
  items: string[];
  empty: string;
}

export interface ProfileBody {
  facts: ProfileFactView[];
  flags: ProfileFlagView[];
  lists: ProfileListView[];
}

export interface ProfileCardView extends ProfileBody {
  key: WorkspacePlatform;
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
}

export interface ProfileSource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface InventoryItemView {
  key: string;
  label: string;
  meta: string[];
  muted: boolean;
  title: string | null;
}

export interface InventoryGroupView {
  key: string;
  title: string;
  count: number;
  items: InventoryItemView[];
}

export interface InventoryBody {
  defaults: InventoryItemView[];
  groups: InventoryGroupView[];
}

export interface WorkspaceSectionHead {
  title: string;
  description: string;
  help: string;
  state: SectionState | null;
  ai: SectionAi | null;
}

export interface InventorySectionView extends WorkspaceSectionHead, InventoryBody {}

export interface TaskStatusView {
  key: string;
  label: string;
  tone: WorkspaceTone;
}

export interface TaskRowView {
  key: string;
  status: string;
  tone: WorkspaceTone;
  subject: string;
}

export interface PlanRowView {
  key: string;
  platform: string | null;
  title: string;
  size: string;
  age: string;
}

export interface TasksBody {
  hasTasks: boolean;
  tasksSummary: string | null;
  statuses: TaskStatusView[];
  tasks: TaskRowView[];
  tasksMore: string | null;
  tasksEmpty: string;
  plansSummary: string;
  plans: PlanRowView[];
  plansMore: string | null;
  plansEmpty: string;
}

export interface TasksSectionView extends WorkspaceSectionHead, TasksBody {}

export function formatPlan(subscriptionType: string | null | undefined): string {
  if (!subscriptionType) return 'free';
  const t = subscriptionType.toLowerCase();
  if (t === 'pro') return 'Pro';
  if (t === 'max') return 'Max';
  if (/max.?5/.test(t)) return 'Max 5x';
  if (/max.?20/.test(t)) return 'Max 20x';
  if (t === 'enterprise') return 'Enterprise';
  if (t === 'team') return 'Team';
  return subscriptionType;
}

export function formatChatGptPlan(planType: string | null | undefined): string {
  if (!planType) return UNSET;
  return `ChatGPT ${planType.charAt(0).toUpperCase()}${planType.slice(1)}`;
}

export function cleanError(error: string): string {
  return error.replace(/^\w*Error:\s*/, '');
}

// 'default' = a mode the tool falls back on; '—' = a value the tool picks itself.
const DEFAULT = 'default';
const UNSET = '—';

const LOGIN: Record<'chatgpt' | 'apikey', string> = { chatgpt: 'ChatGPT', apikey: 'API key' };

const PROFILE_HEAD: Record<WorkspacePlatform, Pick<ProfileCardView, 'title' | 'description' | 'help'>> = {
  claude: {
    title: 'Claude Code profile',
    description: 'Active CLI settings from settings.json',
    help:
      "Your active Claude Code CLI settings read from settings.json: default model, effort level, subscription, permission mode, enabled integrations, and the workspaces and command prefixes you've authorized.",
  },
  codex: {
    title: 'Codex profile',
    description: 'Active Codex settings from config.toml',
    help:
      'Your active Codex settings read from config.toml in the Codex data folder: default model, reasoning effort, plan, service tier, approval policy and sandbox, enabled plugins, and trusted projects. Only these keys are read — never MCP server env vars, args or tokens, and never project paths.',
  },
};

const PROFILE_ERROR: Record<WorkspacePlatform, string> = {
  claude: 'Could not load the Claude Code settings',
  codex: 'Could not load the Codex settings',
};

const PROFILE_SKELETON_ROWS = 8;
const EMPTY_BODY: ProfileBody = { facts: [], flags: [], lists: [] };

function fact(label: string, value: string, options: { title?: string; help?: string; capitalize?: boolean } = {}): ProfileFactView {
  return {
    label,
    value,
    title: options.title ?? value,
    help: options.help ?? null,
    capitalize: Boolean(options.capitalize),
  };
}

function flag(label: string, on: boolean | undefined, onText: string, offText: string): ProfileFlagView {
  return { label, value: on ? onText : offText, tone: on ? 'success' : 'neutral' };
}

function spaced(mode: string): string {
  return mode.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function claudeBody(config: ClaudeConfig, isApi: boolean): ProfileBody {
  const allowedDirs = config.permissions?.additionalDirectories ?? [];
  const allowedCommands = config.permissions?.allow ?? [];
  const mode = config.permissions?.defaultMode ?? DEFAULT;
  return {
    facts: [
      fact('Default model', config.model ?? DEFAULT, { capitalize: true }),
      fact('Effort level', config.effortLevel ?? UNSET, { capitalize: true }),
      fact(isApi ? 'Billing' : 'Subscription', isApi ? 'API · pay-as-you-go' : formatPlan(config.subscriptionType), {
        help: isApi
          ? 'No Claude.ai subscription token found — Claude Code is billed pay-as-you-go (API).'
          : 'Read from ~/.claude/.credentials.json — updates when Claude Code refreshes its login token.',
      }),
      fact('Rate limit tier', isApi ? UNSET : config.rateLimitTier ? config.rateLimitTier.replace(/_/g, ' ') : DEFAULT, {
        title: isApi ? 'Not applicable in API mode' : config.rateLimitTier ?? DEFAULT,
      }),
      fact('Permission mode', spaced(mode), { title: mode, capitalize: true }),
      fact('Auto-update channel', config.autoUpdatesChannel ?? 'latest', { capitalize: true }),
      fact('Enabled plugins', String(Object.values(config.enabledPlugins ?? {}).filter(Boolean).length)),
      fact('Marketplaces', String(Object.keys(config.extraKnownMarketplaces ?? {}).length)),
    ],
    flags: [
      flag('Voice mode', config.voiceEnabled, 'Enabled', 'Disabled'),
      flag('Remote control', config.remoteControlAtStartup, 'Active', 'Inactive'),
      flag('Input alerts', config.inputNeededNotifEnabled, 'On', 'Off'),
      flag('Agent push', config.agentPushNotifEnabled, 'On', 'Off'),
    ],
    lists: [
      {
        title: 'Authorized workspaces',
        count: allowedDirs.length,
        items: allowedDirs,
        empty: 'No extra directories registered',
      },
      {
        title: 'Approved command prefixes',
        count: allowedCommands.length,
        items: allowedCommands,
        empty: 'No automated commands pre-approved',
      },
    ],
  };
}

// config.toml is allowlisted keys only, see server/codex-config.ts.
function codexBody(config: CodexConfigData, live: CodexLiveData | null): ProfileBody {
  const apiKey = config.authMode === 'apikey';
  const { trusted, untrusted, total } = config.projects;
  const servers = config.mcpServers.map((m) => (m.command ? `${m.name} · ${m.command}` : m.name));
  return {
    facts: [
      fact('Default model', config.model ?? DEFAULT),
      fact('Effort level', config.reasoningEffort ?? UNSET, { capitalize: true }),
      fact(apiKey ? 'Billing' : 'Subscription', apiKey ? 'API · pay-as-you-go' : formatChatGptPlan(live?.planType), {
        help: apiKey
          ? 'Codex is signed in with an OpenAI API key — billed pay-as-you-go.'
          : 'The ChatGPT plan on the Codex login token (auth.json) — updates when the ChatGPT app refreshes its login.',
      }),
      fact('Service tier', config.serviceTier ?? DEFAULT, { capitalize: true }),
      fact('Approval policy', config.approvalPolicy ?? DEFAULT, { capitalize: true }),
      fact('Sandbox mode', config.sandboxMode ?? DEFAULT, { capitalize: true }),
      fact('Enabled plugins', String(config.plugins.filter((p) => p.enabled).length)),
      fact('Marketplaces', String(config.marketplaces.length)),
    ],
    flags: [
      { label: 'Personality', value: config.personality ?? DEFAULT, tone: config.personality ? 'info' : 'neutral' },
      flag('Notify hook', config.notify, 'On', 'Off'),
      config.authMode
        ? { label: 'Login', value: LOGIN[config.authMode], tone: 'success' }
        : { label: 'Login', value: 'Signed out', tone: 'warning' },
      flag('Config file', config.available, 'Found', 'Not found'),
    ],
    lists: [
      {
        title: 'Trusted projects',
        count: trusted,
        items: [],
        empty:
          total > 0
            ? `${plural(trusted, 'trusted project')}${untrusted ? ` · ${untrusted} untrusted` : ''} — paths are not read`
            : 'No projects registered',
      },
      { title: 'MCP servers', count: servers.length, items: servers, empty: 'No MCP servers configured' },
    ],
  };
}

function profileCard(key: WorkspacePlatform, source: ProfileSource<unknown>, body: ProfileBody | null): ProfileCardView {
  const state: SectionState | null = body
    ? null
    : source.error && !source.loading
      ? { kind: 'error', title: PROFILE_ERROR[key], description: `${cleanError(source.error)} — the dashboard keeps retrying.` }
      : { kind: 'loading', skeleton: 'text', rows: PROFILE_SKELETON_ROWS, height: 400 };
  return { key, ...PROFILE_HEAD[key], state, ...(body ?? EMPTY_BODY) };
}

export function buildClaudeProfile(source: ProfileSource<ClaudeConfig>, isApi: boolean): ProfileCardView {
  return profileCard('claude', source, source.data ? claudeBody(source.data, isApi) : null);
}

export function buildCodexProfile(source: ProfileSource<CodexConfigData>, live: CodexLiveData | null): ProfileCardView {
  return profileCard('codex', source, source.data ? codexBody(source.data, live) : null);
}

export function workspaceSource(platform: Platform): 'claude' | 'codex' | 'all' {
  return platform === 'both' ? 'all' : platform;
}

export const WORKSPACE_DESCRIPTION: Record<Platform, string> = {
  claude: 'How Claude Code is set up on this machine: its profile, installed integrations, tasks and plans.',
  codex: 'How Codex is set up on this machine: its profile, installed integrations and saved plans.',
  both: 'How Claude Code and Codex are set up on this machine: their profiles, installed integrations, tasks and plans.',
};

export const INVENTORY_DESCRIPTION: Record<Platform, string> = {
  claude: 'Plugins, MCP servers, marketplaces, skills and hooks',
  codex: 'Plugins, MCP servers, marketplaces, skills, hooks and automations',
  both: 'Both platforms in one inventory, each item tagged with its platform',
};

export const INVENTORY_HELP: Record<Platform, string> = {
  claude:
    'Installed plugins, registered MCP servers (global vs project-scoped), plugin marketplaces, your skills and any configured hooks — your local Claude Code integration inventory.',
  codex:
    'Plugins from config.toml (turned-off ones dimmed), marketplaces, MCP servers (name and launch program only — never their env vars or args), the notify hook, your skills (bundled ones marked) and scheduled automations — your local Codex integration inventory.',
  both:
    "Both platforms' integrations in one inventory, each item tagged Claude or Codex: plugins, MCP servers, marketplaces, skills, hooks and Codex's scheduled automations.",
};

export const TASKS_DESCRIPTION: Record<Platform, string> = {
  claude: 'Tracked tasks and saved plan documents',
  codex: 'Plans saved from planning turns',
  both: 'Claude Code tasks and the plans both platforms saved',
};

export const TASKS_HELP: Record<Platform, string> = {
  claude:
    "Tasks tracked by Claude Code's task tooling (completion + blocked) and the plan documents under ~/.claude/plans, with size and age.",
  codex:
    'The plans Codex saved from its planning turns (plans/ in the Codex data folder), with size and age. Codex keeps no task list, so the task side stays empty.',
  both:
    'Claude Code tasks (completion + blocked) and the plans both platforms saved, each plan tagged with its platform, with size and age.',
};

// Codex has no task tracker at all, so its column says so instead of "none tracked".
const EMPTY_TASKS: Record<Platform, string> = {
  claude: 'No tasks tracked.',
  codex: 'Codex keeps no task list — its plans are in the other column.',
  both: 'No tasks tracked.',
};

const EMPTY_WORKSPACE: Record<Platform, string> = {
  claude: 'Tasks appear when Claude Code tracks them, and plans when it saves one under ~/.claude/plans.',
  codex: 'Codex keeps no task list. Plans appear once a planning turn saves one.',
  both: 'Tasks appear when Claude Code tracks them, and plans when either platform saves one.',
};

const MAX_TASKS = 12;
const MAX_PLANS = 14;

const STATUS_TONE: Record<string, WorkspaceTone> = {
  completed: 'success',
  in_progress: 'accent',
  pending: 'neutral',
  blocked: 'danger',
};

function statusTone(status: string): WorkspaceTone {
  return STATUS_TONE[status] ?? 'neutral';
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

function platformTag(platform: WorkspacePlatform | undefined): string[] {
  return platform ? [PLATFORM_NOUN[platform]] : [];
}

function item(key: string, label: string, options: { meta?: string[]; muted?: boolean; title?: string } = {}): InventoryItemView {
  return { key, label, meta: options.meta ?? [], muted: Boolean(options.muted), title: options.title ?? null };
}

export function buildInventory(data: InventoryData): InventoryBody {
  const defaults: InventoryItemView[] = [];
  if (data.model) defaults.push(item('model', `model: ${data.model}`));
  if (data.effortLevel) defaults.push(item('effort', `effort: ${data.effortLevel}`));

  const groups: InventoryGroupView[] = [
    {
      key: 'mcp',
      title: 'MCP servers',
      count: data.mcpServers.length,
      items: data.mcpServers.map((m) =>
        item(`${m.platform ?? ''}:${m.name}`, m.name, {
          meta: [m.scope, ...platformTag(m.platform)],
          title: m.command ? `${m.name} — launches ${m.command}` : undefined,
        }),
      ),
    },
    {
      key: 'plugins',
      title: 'Installed plugins',
      count: data.plugins.length,
      items: data.plugins.map((p) => {
        const off = p.enabled === false;
        return item(`${p.platform ?? ''}:${p.name}@${p.marketplace}`, p.name, {
          meta: [...(p.marketplace ? [`@${p.marketplace}`] : []), ...(off ? ['off'] : []), ...platformTag(p.platform)],
          muted: off,
          title: off ? `${p.name} is installed but turned off` : undefined,
        });
      }),
    },
    {
      key: 'marketplaces',
      title: 'Marketplaces',
      count: data.marketplaces.length,
      items: data.marketplaces.map((m) => item(m, m)),
    },
  ];

  if (data.skills) {
    groups.push({
      key: 'skills',
      title: 'Skills',
      count: data.skills.length,
      items: data.skills.map((s) =>
        item(`${s.platform ?? ''}:${s.system ? '.' : ''}${s.name}`, s.name, {
          meta: [...(s.system ? ['bundled'] : []), ...platformTag(s.platform)],
          title: s.system ? 'Bundled with the app' : undefined,
        }),
      ),
    });
  }

  if (data.automations && data.automations.length > 0) {
    groups.push({
      key: 'automations',
      title: 'Automations',
      count: data.automations.length,
      items: data.automations.map((a) =>
        item(`${a.platform ?? ''}:${a.name}`, a.name, {
          meta: [...(a.schedule ? [a.schedule] : []), ...platformTag(a.platform)],
          muted: a.status !== '' && a.status !== 'active',
          title: a.status ? `${a.name} — ${a.status}` : a.name,
        }),
      ),
    });
  }

  if (data.hooks.length > 0) {
    groups.push({ key: 'hooks', title: 'Hooks', count: data.hooks.length, items: data.hooks.map((h) => item(h, h)) });
  }

  return { defaults, groups };
}

export function inventoryState(source: ProfileSource<InventoryData>, body: InventoryBody | null): SectionState | null {
  if (!body) {
    return source.error && !source.loading
      ? { kind: 'error', title: 'Could not load the integration inventory', description: `${cleanError(source.error)} — the dashboard keeps retrying.` }
      : { kind: 'loading', skeleton: 'text', rows: 6, height: 280 };
  }
  const empty = body.defaults.length === 0 && body.groups.every((group) => group.count === 0);
  return empty
    ? {
        kind: 'empty',
        title: 'No integrations found',
        description: 'Install a plugin, register an MCP server or add a skill and it shows up here.',
      }
    : null;
}

export function buildTasks(data: WorkspaceTasksData, platform: Platform): TasksBody {
  const { tasks, plans } = data;
  const shownTasks = tasks.items.slice(0, MAX_TASKS);
  const shownPlans = plans.items.slice(0, MAX_PLANS);
  return {
    hasTasks: tasks.total > 0,
    tasksSummary: tasks.total > 0 ? `${(tasks.completionRate * 100).toFixed(0)}% complete · ${tasks.total} total` : null,
    statuses: Object.entries(tasks.byStatus).map(([status, n]) => ({
      key: status,
      label: `${statusLabel(status)}: ${n}`,
      tone: statusTone(status),
    })),
    tasks: shownTasks.map((t) => {
      const status = t.blocked ? 'blocked' : t.status;
      return { key: t.id, status: statusLabel(status), tone: statusTone(status), subject: t.subject };
    }),
    tasksMore: tasks.total > shownTasks.length && shownTasks.length > 0 ? `Showing ${shownTasks.length} of ${tasks.total}` : null,
    tasksEmpty: EMPTY_TASKS[platform],
    plansSummary: `${plans.total} total`,
    plans: shownPlans.map((p) => ({
      key: `${p.platform ?? ''}:${p.name}`,
      platform: p.platform ? PLATFORM_NOUN[p.platform] : null,
      title: p.title,
      size: `${(p.sizeBytes / 1024).toFixed(0)} KB`,
      age: p.ageDays === 0 ? 'today' : `${p.ageDays}d ago`,
    })),
    plansMore: plans.total > shownPlans.length && shownPlans.length > 0 ? `Showing ${shownPlans.length} of ${plans.total}` : null,
    plansEmpty: 'No plans found.',
  };
}

export function tasksState(source: ProfileSource<WorkspaceTasksData>, platform: Platform): SectionState | null {
  if (!source.data) {
    return source.error && !source.loading
      ? { kind: 'error', title: 'Could not load tasks and plans', description: `${cleanError(source.error)} — the dashboard keeps retrying.` }
      : { kind: 'loading', skeleton: 'text', rows: 6 };
  }
  const empty = source.data.tasks.total === 0 && source.data.plans.items.length === 0;
  return empty ? { kind: 'empty', title: 'No tasks or plans yet', description: EMPTY_WORKSPACE[platform] } : null;
}

export const EMPTY_INVENTORY_BODY: InventoryBody = { defaults: [], groups: [] };

export const EMPTY_TASKS_BODY: TasksBody = {
  hasTasks: false,
  tasksSummary: null,
  statuses: [],
  tasks: [],
  tasksMore: null,
  tasksEmpty: '',
  plansSummary: '',
  plans: [],
  plansMore: null,
  plansEmpty: '',
};
