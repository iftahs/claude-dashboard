import type { ClaudeConfig, CodexConfigData, CodexLiveData } from '@/types';
import type { ConfigProfileView, ProfileFlag, ProfileTone } from './types';

/** Human label for the OAuth subscriptionType values Claude Code writes to .credentials.json. */
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

export const TONE_CLASS: Record<ProfileTone, string> = {
  clay: 'text-clay-400',
  emerald: 'text-emerald-400',
  cyan: 'text-cyan-400',
  indigo: 'text-indigo-400',
  amber: 'text-amber-400',
  violet: 'text-violet-400',
};

/** An unset setting: 'default' for a mode the tool falls back on, '—' for a value it picks itself. */
const DEFAULT = 'default';
const UNSET = '—';

function flag(label: string, on: boolean | undefined, onText: string, offText: string): ProfileFlag {
  return { label, value: on ? onText : offText, variant: on ? 'success' : 'neutral' };
}

/** `acceptEdits` → `accept Edits` (rendered capitalised). */
function spaced(mode: string): string {
  return mode.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function claudeProfileView(config: ClaudeConfig, isApi: boolean): ConfigProfileView {
  const allowedDirs = config.permissions?.additionalDirectories ?? [];
  const allowedCommands = config.permissions?.allow ?? [];
  const mode = config.permissions?.defaultMode ?? DEFAULT;
  return {
    title: 'Claude Code Config Profile',
    help:
      "Your active Claude Code CLI settings read from settings.json: default model, effort level, subscription, permission mode, enabled integrations, and the workspaces & command prefixes you've authorized.",
    subtitle: 'Current active CLI environment settings',
    tiles: [
      { label: 'Default Model', value: config.model ?? DEFAULT, tone: 'clay', capitalize: true },
      { label: 'Effort Level', value: config.effortLevel ?? UNSET, tone: 'emerald', capitalize: true },
      {
        label: isApi ? 'Billing' : 'Subscription',
        value: isApi ? 'API · pay-as-you-go' : formatPlan(config.subscriptionType),
        title: isApi
          ? 'No Claude.ai subscription token found — Claude Code is billed pay-as-you-go (API).'
          : 'Read from ~/.claude/.credentials.json — updates when Claude Code refreshes its login token',
        tone: 'cyan',
      },
      {
        label: 'Rate Limit Tier',
        value: isApi ? UNSET : config.rateLimitTier ? config.rateLimitTier.replace(/_/g, ' ') : DEFAULT,
        title: isApi ? 'n/a in API mode' : config.rateLimitTier ?? DEFAULT,
        tone: 'indigo',
      },
      { label: 'Permission Mode', value: spaced(mode), title: mode, tone: 'amber', capitalize: true },
      { label: 'Auto-Update Channel', value: config.autoUpdatesChannel ?? 'latest', tone: 'violet', capitalize: true },
    ],
    flags: [
      flag('Voice Mode', config.voiceEnabled, 'Enabled', 'Disabled'),
      flag('Remote Control', config.remoteControlAtStartup, 'Active', 'Inactive'),
      flag('Input Alerts', config.inputNeededNotifEnabled, 'On', 'Off'),
      flag('Agent Push', config.agentPushNotifEnabled, 'On', 'Off'),
    ],
    counts: [
      { label: 'Plugins', value: Object.values(config.enabledPlugins ?? {}).filter(Boolean).length },
      { label: 'Marketplaces', value: Object.keys(config.extraKnownMarketplaces ?? {}).length },
    ],
    lists: [
      { title: 'Authorized Workspaces', items: allowedDirs, empty: 'No extra directories registered' },
      { title: 'Approved Command Prefixes', items: allowedCommands, empty: 'No automated commands pre-approved' },
    ],
  };
}

/** 'plus' → 'Plus', 'pro' → 'Pro' — ChatGPT plan ids as the ChatGPT app names them. */
export function formatChatGptPlan(planType: string | null | undefined): string {
  if (!planType) return UNSET;
  return `ChatGPT ${planType.charAt(0).toUpperCase()}${planType.slice(1)}`;
}

const LOGIN: Record<'chatgpt' | 'apikey', string> = { chatgpt: 'ChatGPT', apikey: 'API key' };

// config.toml is allowlisted keys only, see server/codex-config.ts.
export function codexProfileView(config: CodexConfigData, live: CodexLiveData | null): ConfigProfileView {
  const apiKey = config.authMode === 'apikey';
  const { trusted, untrusted, total } = config.projects;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return {
    title: 'Codex Config Profile',
    help:
      'Your active Codex settings read from config.toml in the Codex data folder: default model, reasoning effort, plan, service tier, approval policy and sandbox, enabled plugins, and trusted projects. Only these keys are read — never MCP server env vars, args or tokens, and never project paths.',
    subtitle: 'Current Codex (ChatGPT desktop) settings',
    tiles: [
      { label: 'Default Model', value: config.model ?? DEFAULT, tone: 'clay' },
      { label: 'Effort Level', value: config.reasoningEffort ?? UNSET, tone: 'emerald', capitalize: true },
      {
        label: apiKey ? 'Billing' : 'Subscription',
        value: apiKey ? 'API · pay-as-you-go' : formatChatGptPlan(live?.planType),
        title: apiKey
          ? 'Codex is signed in with an OpenAI API key — billed pay-as-you-go.'
          : 'The ChatGPT plan on the Codex login token (auth.json) — updates when the ChatGPT app refreshes its login',
        tone: 'cyan',
      },
      { label: 'Service Tier', value: config.serviceTier ?? DEFAULT, tone: 'indigo', capitalize: true },
      { label: 'Approval Policy', value: config.approvalPolicy ?? DEFAULT, tone: 'amber', capitalize: true },
      { label: 'Sandbox Mode', value: config.sandboxMode ?? DEFAULT, tone: 'violet', capitalize: true },
    ],
    flags: [
      { label: 'Personality', value: config.personality ?? DEFAULT, variant: config.personality ? 'info' : 'neutral' },
      flag('Notify Hook', config.notify, 'On', 'Off'),
      config.authMode
        ? { label: 'Login', value: LOGIN[config.authMode], variant: 'success' }
        : { label: 'Login', value: 'Signed out', variant: 'warning' },
      flag('Config File', config.available, 'Found', 'Not found'),
    ],
    counts: [
      { label: 'Plugins', value: config.plugins.filter((p) => p.enabled).length },
      { label: 'Marketplaces', value: config.marketplaces.length },
    ],
    lists: [
      {
        title: 'Trusted Projects',
        count: trusted,
        items: [],
        empty:
          total > 0
            ? `${plural(trusted, 'trusted project')}${untrusted ? ` · ${untrusted} untrusted` : ''} — paths are not read`
            : 'No projects registered',
      },
      {
        title: 'MCP Servers',
        items: config.mcpServers.map((m) => (m.command ? `${m.name} · ${m.command}` : m.name)),
        empty: 'No MCP servers configured',
      },
    ],
  };
}
