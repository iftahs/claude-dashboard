import type { Platform } from '@/lib/platform';
import type { AiBackend, AiStatus } from '@/types';

export type AiDays = '7' | '30' | '90';

export interface AiOption<T extends string = string> {
  value: T;
  label: string;
}

export interface AiChatMessageView {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
  datasets?: string[];
}

export interface AiSetupView {
  title: string;
  description: string;
  linkLabel: string;
  href: string;
}

export interface AiChatView {
  setup: AiSetupView | null;
  messages: AiChatMessageView[];
  loading: boolean;
  starters: string[];
  followUps: string[];
  contextHref: string;
}

export interface AiBackendView {
  label: string;
  title: string;
}

export interface AiModelPickerView {
  value: string;
  options: AiOption[];
}

export const AI_DAY_OPTIONS: readonly AiOption<AiDays>[] = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
];

export const AI_DEFAULT_DAYS: AiDays = '30';

export const AI_SETTINGS_HREF = '/settings#ai';

// Each question must be answerable on its platform — no workflow question under Codex (Claude Code only).
export const SUGGESTIONS: Record<Platform, string[]> = {
  claude: [
    'Which workflow cost me the most?',
    "What's my error-rate trend?",
    'Which project costs the most?',
    'Am I close to my weekly limit?',
  ],
  codex: [
    'Which thread was the heaviest?',
    "What's my error-rate trend?",
    'Which project costs the most?',
    'Am I close to my Codex weekly limit?',
  ],
  both: [
    'How does Claude compare to Codex on cost?',
    "What's my error-rate trend?",
    'Which project costs the most?',
    'Am I close to any rate limit?',
  ],
};

export const INTRO: Record<Platform, string> = {
  claude: 'Ask anything about your Claude Code usage. Answers are based on your local usage aggregates.',
  codex: 'Ask anything about your Codex usage. Answers are based on your local usage aggregates.',
  both: 'Ask anything about your Claude Code and Codex usage. Answers are based on your local usage aggregates.',
};

const SERVER_BACKENDS: Partial<Record<AiBackend, AiBackendView>> = {
  cli: { label: 'Claude CLI', title: 'Answers come from your local Claude CLI (claude -p).' },
  api: { label: 'Claude.ai', title: 'Answers come from the Claude.ai API using your local token.' },
  apikey: {
    label: 'Anthropic API',
    title: 'Answers come from the Anthropic Messages API (ANTHROPIC_AUTH_TOKEN/ANTHROPIC_BASE_URL or ANTHROPIC_API_KEY).',
  },
};

export function serverBackend(status: AiStatus | null): AiBackendView | null {
  return status ? SERVER_BACKENDS[status.available] ?? null : null;
}

export function modelPicker(model: string, models: readonly string[]): AiModelPickerView {
  const list = models.includes(model) ? models : [model, ...models];
  return { value: model, options: list.map((value) => ({ value, label: value })) };
}

export function setupView(status: AiStatus | null): AiSetupView {
  return {
    title: 'AI insights are not set up yet',
    description: `${status?.reason ? `${status.reason} ` : ''}Pick a provider and paste an API key in Settings, or put the claude CLI on your PATH.`,
    linkLabel: 'Open AI settings',
    href: AI_SETTINGS_HREF,
  };
}

export function datasetsNote(datasets: string[] | undefined): string | null {
  return datasets && datasets.length > 0 ? `Answered from: overview + ${datasets.join(', ')}` : null;
}
