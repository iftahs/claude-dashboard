import type { IconName } from '@/components/design-system/atoms/Icon/types';
import type { SegmentedControlOption } from '@/components/design-system/atoms/SegmentedControl/types';
import type { SelectOption } from '@/components/design-system/atoms/Select/types';
import type { TabItem } from '@/components/design-system/atoms/Tabs/types';
import type { ChartTooltipRow } from '@/components/design-system/molecules/ChartTooltip/types';
import { modelColor } from '@/lib/palette';
import type {
  AgentFilter,
  BadgeSample,
  GallerySection,
  GallerySectionId,
  InsightView,
  KeyValueSample,
  MenuActionSample,
  MeterSample,
  ModelSample,
  PlatformValue,
  RangeValue,
  SessionSample,
  SkeletonSample,
  StatSample,
  StatusSample,
  ToastSample,
} from './types';

export const ROW = 'flex flex-wrap items-center gap-3';

export const INLINE_STATUS = 'inline-flex items-center gap-1.5 whitespace-nowrap text-small text-fg-muted';

export const PAGE_LOADED_AT = Date.now();

export const GALLERY_SECTIONS: readonly GallerySection[] = [
  {
    id: 'atoms',
    label: 'Atoms',
    icon: 'layers',
    count: 25,
    description: 'The smallest parts. An atom imports no other design-system component.',
  },
  {
    id: 'molecules',
    label: 'Molecules',
    icon: 'layout',
    count: 14,
    description: 'Atoms wired into one focused job.',
  },
  {
    id: 'templates',
    label: 'Templates',
    icon: 'panel',
    count: 5,
    description: 'Layout only. This page is arranged with all five.',
  },
];

export function sectionFromHash(hash: string): GallerySectionId {
  const id = hash.replace(/^#/, '');
  return GALLERY_SECTIONS.find((section) => section.id === id)?.id ?? 'atoms';
}

export const PLATFORM_COLORS = {
  claude: 'rgb(var(--platform-claude))',
  codex: 'rgb(var(--platform-codex))',
};

export const MODELS: readonly ModelSample[] = [
  { id: 'claude-opus-5-5', label: 'opus 5.5' },
  { id: 'claude-sonnet-5-5', label: 'sonnet 5.5' },
  { id: 'claude-haiku-4-5', label: 'haiku 4.5' },
  { id: 'gpt-5.6-terra', label: 'gpt-5.6-terra' },
  { id: 'claude-fable-5-1', label: 'fable 5.1' },
];

export const PLATFORM_OPTIONS: readonly SegmentedControlOption<PlatformValue>[] = [
  { value: 'claude', label: 'Claude' },
  { value: 'codex', label: 'Codex' },
  { value: 'both', label: 'Both' },
];

export const RANGE_OPTIONS: readonly SegmentedControlOption<RangeValue>[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '1y', label: '1y' },
];

export const INSIGHT_TABS: readonly TabItem<InsightView>[] = [
  { value: 'reliability', label: 'Reliability' },
  { value: 'tools', label: 'Tools' },
  { value: 'code', label: 'Code' },
  { value: 'pace', label: 'Pace' },
];

export const INSIGHT_PANELS: Record<InsightView, string> = {
  reliability: 'Failure rate by tool. Rejections are never counted as failures.',
  tools: 'Tool calls per session, one per tool use.',
  code: 'Lines added and removed, commits and pull requests.',
  pace: 'Turn duration and the time you spent waiting.',
};

export const AGENT_TABS: readonly TabItem<AgentFilter>[] = [
  { value: 'running', label: 'Running', count: 3 },
  { value: 'finished', label: 'Finished', count: 12 },
  { value: 'failed', label: 'Failed', count: 1 },
];

export const WEEK_START_OPTIONS: SelectOption[] = [
  { value: 'monday', label: 'Week starts Monday' },
  { value: 'sunday', label: 'Week starts Sunday' },
  { value: 'saturday', label: 'Week starts Saturday' },
];

export const MODEL_OPTIONS: SelectOption[] = MODELS.map((model) => ({ value: model.id, label: model.label }));

export const BADGES: readonly BadgeSample[] = [
  { label: 'Completed', tone: 'success', icon: 'check' },
  { label: '70% of limit', tone: 'warning', icon: 'alert' },
  { label: 'Waiting on you', tone: 'danger', icon: 'alert' },
  { label: 'Update available', tone: 'info', icon: 'info' },
  { label: 'Binding limit', tone: 'accent' },
  { label: '12', tone: 'neutral' },
];

export const STATUSES: readonly StatusSample[] = [
  { label: 'Running', tone: 'success', pulse: true },
  { label: 'Stalled', tone: 'warning', pulse: false },
  { label: 'Waiting on you', tone: 'danger', pulse: false },
  { label: 'Idle', tone: 'neutral', pulse: false },
  { label: 'Queued', tone: 'info', pulse: false },
  { label: 'Claude', tone: 'accent', pulse: false },
];

export const METERS: readonly MeterSample[] = [
  { label: '5-hour limit', value: '40%', percent: 40, tone: 'accent', note: 'Below 70%: accent. Resets in 2h 14m.' },
  { label: 'Weekly limit', value: '83%', percent: 83, tone: 'warning', note: '70% and above: warning. Resets Monday 01:00.' },
  {
    label: 'This week against cap',
    value: '$412.80 of $450.00',
    percent: 92,
    tone: 'danger',
    note: '90% and above: danger.',
  },
];

export const STATS: readonly StatSample[] = [
  { label: 'Runs', value: '69' },
  { label: 'Success rate', value: '97%', sub: '67 completed, 2 failed', tone: 'success' },
  { label: 'Est. cost', value: '~$1,332', sub: 'Blended estimate', help: 'Estimated equivalent API cost, not a bill.' },
  { label: 'Limit hits', value: '3', sub: 'Last 30 days', tone: 'warning' },
  { label: 'Failed runs', value: '2', sub: 'Both on Sep 22', tone: 'danger' },
  { label: 'Claude share', value: '94%', sub: '388M of 412M tok', tone: 'accent' },
];

export const DENSE_STATS: readonly StatSample[] = [
  { label: 'Tool calls', value: '33K' },
  { label: 'Agents spawned', value: '631' },
  { label: 'Avg duration', value: '1h 16m' },
  { label: 'Total tokens', value: '103M' },
];

export const SESSIONS: readonly SessionSample[] = [
  {
    key: 'row-widths',
    title: 'Fix workflow row widths so the model chip stays on one line',
    model: MODELS[0],
    tokens: '1.3M tok',
    cost: '~$7.88',
    when: '25s ago',
  },
  {
    key: 'schema',
    title: 'Design schema, RLS and sync contract for the training app',
    model: MODELS[1],
    tokens: '4.9M tok',
    cost: '~$38.40',
    when: '2h ago',
  },
  {
    key: 'review',
    title: 'Review findings on pull request 42',
    model: MODELS[3],
    tokens: '720K tok',
    cost: '~$4.10',
    when: 'Sep 30',
  },
];

export const SPARK_VALUES: number[] = [31, 28, 44, 36, 22, 39, 41];

export const ICON_NAMES: readonly IconName[] = [
  'layout',
  'activity',
  'bot',
  'workflow',
  'trending',
  'layers',
  'bars',
  'list',
  'folder',
  'sparkles',
  'sliders',
  'search',
  'clock',
  'download',
  'alert',
  'info',
  'refresh',
  'inbox',
  'gitBranch',
  'terminal',
];

export const MARKDOWN_SAMPLE = [
  '# Weekly limit at 83%',
  'Workflow subagents are the **largest share** of this week, at `38%` of cost-weighted usage.',
  '',
  '## What to try',
  '- Run research phases on `sonnet 5.5` instead of `opus 5.5`.',
  '- Keep _one_ workflow running at a time until the reset.',
  '',
  '1. Open Live usage.',
  '2. Check what is contributing to your limits.',
].join('\n');

export const MENU_ACTIONS: readonly MenuActionSample[] = [
  { key: 'open', label: 'Open transcript', icon: 'externalLink' },
  { key: 'copy', label: 'Copy session ID', icon: 'copy' },
  { key: 'export', label: 'Export as CSV', icon: 'download' },
  { key: 'tag', label: 'Add a tag', icon: 'tag', disabled: true },
  { key: 'forget', label: 'Forget archived history', icon: 'trash', tone: 'danger' },
];

export const CHART_TOOLTIP_ROWS: readonly ChartTooltipRow[] = [
  { label: 'opus 5.5', value: '812K tok', color: modelColor('claude-opus-5-5') },
  { label: 'sonnet 5.5', value: '431K tok', color: modelColor('claude-sonnet-5-5') },
  { label: 'haiku 4.5', value: '96K tok', color: modelColor('claude-haiku-4-5') },
];

export const TOASTS: readonly ToastSample[] = [
  { tone: 'info', title: 'Update available', description: 'Version 0.2.1 is ready. Reload to use it.' },
  { tone: 'success', title: 'Export finished', description: 'Saved 30 days of usage as a CSV file.' },
  { tone: 'danger', title: 'Could not reach Claude.ai', description: 'Run claude in a terminal to sign in again.' },
];

export const SKELETONS: readonly SkeletonSample[] = [
  { variant: 'text' },
  { variant: 'stat' },
  { variant: 'chart' },
  { variant: 'bars', rows: 3 },
  { variant: 'gauge', rows: 2 },
];

export const WINDOW_FACTS: readonly KeyValueSample[] = [
  { label: 'Effective tokens', value: '12.4M tok' },
  { label: 'Est. cost', value: '~$18.20' },
  { label: 'Projected at reset', value: '71%' },
];
