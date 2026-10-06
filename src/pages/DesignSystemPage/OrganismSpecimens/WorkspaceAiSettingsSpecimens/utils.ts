import { SUGGESTIONS, setupView, type AiChatMessageView, type AiChatView } from '@/lib/views/ai';
import {
  archiveView,
  dataFolders,
  versionView,
  type ArchiveView,
  type CapPeriod,
  type DataFoldersView,
  type SettingsOption,
  type StatusRow,
  type VersionView,
} from '@/lib/views/settings';
import {
  EMPTY_INVENTORY_BODY,
  EMPTY_TASKS_BODY,
  INVENTORY_DESCRIPTION,
  INVENTORY_HELP,
  TASKS_DESCRIPTION,
  TASKS_HELP,
  buildClaudeProfile,
  buildCodexProfile,
  buildInventory,
  buildTasks,
  inventoryState,
  tasksState,
  type InventorySectionView,
  type ProfileCardView,
  type TasksSectionView,
} from '@/lib/views/workspace';
import type { InventoryData, WorkspaceTasksData } from '@/types';

const SERVER_ERROR = 'Error: HTTP 500';
const LONG_NAME = 'an-integration-with-a-very-long-name-that-has-no-spaces-to-break-on-and-must-truncate-inside-its-chip';

export const PROFILE_CLAUDE: ProfileCardView = buildClaudeProfile(
  {
    data: {
      model: 'opus',
      effortLevel: 'high',
      subscriptionType: 'max_20x',
      rateLimitTier: 'default_claude_max_20x',
      autoUpdatesChannel: 'latest',
      voiceEnabled: true,
      remoteControlAtStartup: false,
      inputNeededNotifEnabled: true,
      agentPushNotifEnabled: false,
      enabledPlugins: { caveman: true, typesafe: true, figma: false },
      extraKnownMarketplaces: { caveman: {}, typesafe: {} },
      permissions: {
        defaultMode: 'acceptEdits',
        additionalDirectories: ['C:\\dev\\my-gym', 'C:\\dev\\shared-configs'],
        allow: [
          'Bash(npm run *)',
          'Bash(git status)',
          'Bash(git diff *)',
          'Read(//c/dev/**)',
          'mcp__context7',
          'Bash(node scripts/check-design-system.mjs)',
          'Bash(npx tsc -b)',
          'Bash(gh pr view *)',
        ],
      },
    },
    loading: false,
    error: null,
  },
  false,
);

export const PROFILE_CODEX: ProfileCardView = buildCodexProfile(
  {
    data: {
      available: true,
      profile: null,
      model: 'gpt-5.6-terra',
      reasoningEffort: 'medium',
      approvalPolicy: 'on-request',
      sandboxMode: 'workspace-write',
      personality: 'pragmatic',
      serviceTier: null,
      notify: true,
      plugins: [{ name: 'browser', marketplace: 'openai-bundled', enabled: true }],
      marketplaces: ['openai-bundled'],
      mcpServers: [{ name: 'node_repl', command: 'node_repl.exe' }],
      projects: { trusted: 4, untrusted: 1, total: 5 },
      authMode: 'chatgpt',
      dir: 'C:\\Users\\you\\.codex',
    },
    loading: false,
    error: null,
  },
  {
    planType: 'plus',
    fiveHour: null,
    weekly: null,
    limitReached: false,
    credits: null,
    resetCredits: null,
    modelAvailability: {},
    origin: 'live',
    snapshotAt: null,
  },
);

export const PROFILE_LOADING: ProfileCardView = buildCodexProfile({ data: null, loading: true, error: null }, null);

export const PROFILE_FAILED: ProfileCardView = buildClaudeProfile({ data: null, loading: false, error: SERVER_ERROR }, false);

const INVENTORY_DATA: InventoryData = {
  plugins: [
    { name: 'caveman', marketplace: 'caveman', version: '1.0.0', platform: 'claude' },
    { name: 'typesafe', marketplace: 'typesafe-ai', version: '0.4.0', platform: 'claude' },
    { name: 'browser', marketplace: 'openai-bundled', version: '1.0.0', platform: 'codex' },
    { name: 'spreadsheets', marketplace: 'openai-primary-runtime', version: '1.0.0', enabled: false, platform: 'codex' },
    { name: LONG_NAME, marketplace: 'a-marketplace-with-a-long-name', version: '1.0.0', enabled: false, platform: 'codex' },
  ],
  marketplaces: ['caveman', 'typesafe-ai', 'openai-bundled'],
  enabledPlugins: [],
  mcpServers: [
    { name: 'context7', scope: 'global', platform: 'claude' },
    { name: 'n8n-mcp', scope: 'project', platform: 'claude' },
    { name: 'node_repl', scope: 'global', command: 'node_repl.exe', platform: 'codex' },
    { name: LONG_NAME, scope: 'global', platform: 'claude' },
  ],
  hooks: ['notify'],
  model: 'opus',
  effortLevel: 'high',
  skills: [
    { name: 'atomic-design', platform: 'claude' },
    { name: 'dataviz', platform: 'claude' },
    { name: 'openai-docs', system: true, platform: 'codex' },
  ],
  automations: [
    { name: 'weekly-report', schedule: 'Weekly · Sun 09:00', status: 'active', platform: 'codex' },
    { name: 'nightly-cleanup', schedule: 'Daily · 02:00', status: 'paused', platform: 'codex' },
  ],
};

const EMPTY_INVENTORY_DATA: InventoryData = { plugins: [], marketplaces: [], enabledPlugins: [], mcpServers: [], hooks: [] };

const INVENTORY_HEAD = {
  title: 'Plugins and MCP · Claude + Codex',
  description: INVENTORY_DESCRIPTION.both,
  help: INVENTORY_HELP.both,
  ai: null,
};

function inventoryView(data: InventoryData | null, loading: boolean, error: string | null): InventorySectionView {
  const body = data ? buildInventory(data) : null;
  return { ...INVENTORY_HEAD, state: inventoryState({ data, loading, error }, body), ...(body ?? EMPTY_INVENTORY_BODY) };
}

export const INVENTORY_VIEWS: readonly InventorySectionView[] = [
  inventoryView(INVENTORY_DATA, false, null),
  inventoryView(EMPTY_INVENTORY_DATA, false, null),
  inventoryView(null, true, null),
  inventoryView(null, false, SERVER_ERROR),
];

const TASKS_DATA: WorkspaceTasksData = {
  tasks: {
    total: 31,
    byStatus: { completed: 19, in_progress: 4, pending: 8 },
    completionRate: 19 / 31,
    items: Array.from({ length: 14 }, (_, index) => ({
      id: `task-${index}`,
      subject:
        index === 0
          ? 'Rebuild the Workspace page on the new design system and keep every legacy control, including the long ones that must truncate'
          : `Task ${index + 1} of the rebuild`,
      status: ['completed', 'in_progress', 'pending'][index % 3],
      blocked: index === 4,
    })),
  },
  plans: {
    total: 3,
    items: [
      { name: 'redesign', title: 'AI Usage: full redesign and atomic design system', sizeBytes: 16_400, ageDays: 0, platform: 'claude' },
      { name: 'parity', title: 'Codex and Claude parity, new data and a doctor for CLAUDE.md', sizeBytes: 9_300, ageDays: 4, platform: 'claude' },
      { name: 'chat', title: 'Live chat for the site', sizeBytes: 4_100, ageDays: 15, platform: 'codex' },
    ],
  },
};

const EMPTY_TASKS_DATA: WorkspaceTasksData = {
  tasks: { total: 0, byStatus: {}, completionRate: 0, items: [] },
  plans: { total: 0, items: [] },
};

const CODEX_TASKS_DATA: WorkspaceTasksData = { tasks: EMPTY_TASKS_DATA.tasks, plans: TASKS_DATA.plans };

function tasksView(data: WorkspaceTasksData | null, platform: 'claude' | 'codex' | 'both', title: string): TasksSectionView {
  return {
    title,
    description: TASKS_DESCRIPTION[platform],
    help: TASKS_HELP[platform],
    ai: null,
    state: tasksState({ data, loading: data === null, error: null }, platform),
    ...(data ? buildTasks(data, platform) : EMPTY_TASKS_BODY),
  };
}

export const TASKS_VIEWS: readonly TasksSectionView[] = [
  tasksView(TASKS_DATA, 'both', 'Tasks and plans · Claude + Codex'),
  tasksView(CODEX_TASKS_DATA, 'codex', 'Tasks and plans · Codex'),
  tasksView(EMPTY_TASKS_DATA, 'claude', 'Tasks and plans'),
  tasksView(null, 'claude', 'Tasks and plans'),
];

export const CHAT_ANSWER =
  '## Heaviest project\n\nYour **heaviest project** this month is `my-gym` at ~$412.\n\n- 61% of it ran on opus 5.5\n- Cache writes peaked on the 12th\n\nThe trend is down 18% against last month.';

export const CHAT_MESSAGES: readonly AiChatMessageView[] = [
  { id: 'q1', role: 'user', content: 'Which project costs the most?' },
  { id: 'a1', role: 'assistant', content: CHAT_ANSWER, datasets: ['projects'] },
  { id: 'q2', role: 'user', content: 'And which model drove it?' },
  { id: 'a2', role: 'assistant', content: 'The model did not answer in time. Try again in a minute.', error: true },
  { id: 'q3', role: 'user', content: 'Am I close to my weekly limit?' },
  { id: 'a3', role: 'assistant', content: '' },
];

export const CHAT_FOLLOW_UPS: string[] = ['Break that down by model', 'Why did cache writes peak on the 12th?', 'Compare with last month'];

const CHAT_BASE: AiChatView = {
  setup: null,
  messages: [],
  loading: false,
  starters: SUGGESTIONS.claude,
  followUps: [],
  contextHref: '#organisms',
};

export const CHAT_EMPTY: AiChatView = CHAT_BASE;

export const CHAT_SETUP: AiChatView = {
  ...CHAT_BASE,
  setup: { ...setupView({ available: 'none', model: '', reason: 'No claude CLI on the PATH and no Claude.ai token found.' }), href: '#organisms' },
};

export function chatView(messages: AiChatMessageView[], followUps: string[]): AiChatView {
  const pending = messages.some((message) => message.role === 'assistant' && !message.error && !message.content);
  return { ...CHAT_BASE, messages, loading: pending, followUps };
}

export const CODEX_ROWS: StatusRow[] = [
  { label: 'Plan', value: 'ChatGPT Plus (detected)', tone: 'ok' },
  {
    label: 'Token',
    value: 'Expired',
    note: 'Open the ChatGPT desktop app once — it refreshes its own token. The dashboard never refreshes it.',
    tone: 'warn',
  },
];

export const PROVIDER_OPTIONS: SettingsOption[] = [
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'openai', label: 'OpenAI' },
];

export const MODEL_OPTIONS: Record<string, SettingsOption[]> = {
  claude: [
    { value: 'claude-opus-5-5', label: 'claude-opus-5-5' },
    { value: 'claude-sonnet-5-5', label: 'claude-sonnet-5-5' },
  ],
  openai: [
    { value: 'gpt-5.6-terra', label: 'gpt-5.6-terra' },
    { value: 'gpt-4.1', label: 'gpt-4.1' },
  ],
};

export const EMPTY_CAPS: Record<CapPeriod, string> = { daily: '', weekly: '', monthly: '' };

export const INITIAL_CAPS: Record<'claude' | 'codex', Record<CapPeriod, string>> = {
  claude: { daily: '60', weekly: '300', monthly: '' },
  codex: EMPTY_CAPS,
};

const ARCHIVE_SUMMARY = { enabled: true, files: 3, bytes: 2_500_000, oldestTs: Date.UTC(2026, 2, 12) };

export function specimenArchive(forgotten: boolean, busy: boolean): ArchiveView {
  return archiveView(forgotten ? { enabled: true, files: 0, bytes: 0, oldestTs: null } : ARCHIVE_SUMMARY, false, busy, null);
}

export const ARCHIVE_LOADING: ArchiveView = archiveView(null, true, false, null);

export const FOLDERS: DataFoldersView = dataFolders(
  {
    code: { events: 1, lastTs: 0 },
    cowork: { available: true, events: 1, lastTs: 0 },
    codex: { available: true, events: 1, lastTs: 0 },
    claudeDir: 'C:\\Users\\you\\.claude',
    coworkDir: 'C:\\Users\\you\\AppData\\Roaming\\Claude\\local-agent-mode-sessions',
    codexDir: 'C:\\Users\\you\\.codex',
  },
  false,
  null,
  null,
);

export const FOLDERS_FAILED: DataFoldersView = dataFolders(null, false, null, null);

export const VERSION_UPDATE: VersionView = versionView(
  {
    current: '0.1.27',
    latest: '0.1.28',
    updateAvailable: true,
    isDocker: true,
    repoUrl: 'https://github.com/iftahs/claude-dashboard',
    changelogUrl: 'https://github.com/iftahs/claude-dashboard/blob/main/CHANGELOG.md',
  },
  false,
);

export const VERSION_LOADING: VersionView = versionView(null, true);

export const FORGET_DELAY_MS = 1200;
