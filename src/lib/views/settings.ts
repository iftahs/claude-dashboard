import { longDateLabel } from '@/lib/format';
import type { CapPlatform, LimitAlertConfig } from '@/lib/limits';
import type { WeekStart } from '@/lib/week';
import type { ArchiveSummary, CodexConfigData, CodexLiveData, SourcesInfo, VersionInfo } from '@/types';

export type SettingsSectionId = 'general' | 'display' | 'alerts' | 'spending' | 'ai' | 'data';

export interface SettingsSectionLink {
  id: SettingsSectionId;
  label: string;
  keywords: string[];
}

export const SETTINGS_PATH = '/settings';

export const SETTINGS_SECTIONS: readonly SettingsSectionLink[] = [
  { id: 'general', label: 'General', keywords: ['usage mode', 'subscription', 'api', 'codex', 'plan'] },
  { id: 'display', label: 'Display', keywords: ['theme', 'dark', 'light', 'appearance', 'week start'] },
  { id: 'alerts', label: 'Alerts', keywords: ['notification', 'sound', 'threshold', 'agent', 'budget'] },
  { id: 'spending', label: 'Spending limits', keywords: ['budget', 'cap', 'usd', 'cost'] },
  { id: 'ai', label: 'AI', keywords: ['provider', 'api key', 'model', 'insights'] },
  { id: 'data', label: 'Data', keywords: ['archive', 'history', 'telemetry', 'analytics', 'folders', 'version', 'update'] },
];

export function settingsHref(id: SettingsSectionId): string {
  return `${SETTINGS_PATH}#${id}`;
}

export interface SettingsOption<T extends string = string> {
  value: T;
  label: string;
}

export type UsageModeChoice = 'auto' | 'subscription' | 'api';
export type AgentAlertChoice = 'visual' | 'notification' | 'sound';
export type AlertModeChoice = 'off' | 'notification' | 'sound';
export type WeekStartChoice = 'auto' | 'sunday' | 'monday';
export type ThemeChoice = 'dark' | 'light';

export const USAGE_MODE_OPTIONS: readonly SettingsOption<UsageModeChoice>[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'api', label: 'API' },
];

export const AGENT_ALERT_OPTIONS: readonly SettingsOption<AgentAlertChoice>[] = [
  { value: 'visual', label: 'Visual only' },
  { value: 'notification', label: 'Notification' },
  { value: 'sound', label: 'With sound' },
];

export const ALERT_MODE_OPTIONS: readonly SettingsOption<AlertModeChoice>[] = [
  { value: 'off', label: 'Off' },
  { value: 'notification', label: 'Notification' },
  { value: 'sound', label: 'With sound' },
];

export const WEEK_START_OPTIONS: readonly SettingsOption<WeekStartChoice>[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
];

export const THEME_OPTIONS: readonly SettingsOption<ThemeChoice>[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

export interface StatusRow {
  label: string;
  value: string;
  note?: string;
  tone: 'ok' | 'warn' | 'muted';
}

export interface GeneralSettingsView {
  modeTitle: string;
  mode: UsageModeChoice;
  detected: string;
  overridden: boolean;
  codex: StatusRow[] | null;
}

export interface DisplaySettingsView {
  weekStart: WeekStartChoice;
  localeNote: string | null;
  theme: ThemeChoice;
}

export interface ThresholdView {
  value: number;
  label: string;
  checked: boolean;
}

export interface AlertSettingsView {
  agent: AgentAlertChoice;
  limitDescription: string;
  limitMode: AlertModeChoice;
  thresholds: ThresholdView[];
  budgetDescription: string;
  budgetMode: AlertModeChoice;
}

export type CapPeriod = 'daily' | 'weekly' | 'monthly';

export interface CapFieldView {
  key: CapPeriod;
  label: string;
  placeholder: string;
  value: string;
}

export interface CapGroupView {
  key: CapPlatform;
  heading: string | null;
  fields: CapFieldView[];
}

export interface SpendingCapsSettingsView {
  description: string;
  groups: CapGroupView[];
}

export interface AiSettingsView {
  provider: string;
  providers: SettingsOption[];
  model: string;
  models: SettingsOption[];
  key: string;
  keyPlaceholder: string;
  keyShown: boolean;
  keySaved: boolean;
}

export type DataBlockStatus = 'loading' | 'error' | 'ready';

export interface ArchiveView {
  status: DataBlockStatus;
  enabled: boolean;
  line: string;
  canForget: boolean;
  busy: boolean;
  error: string | null;
}

export interface DataFolderView {
  label: string;
  path: string;
}

export interface DataFoldersView {
  status: DataBlockStatus;
  rows: DataFolderView[];
}

export interface VersionView {
  status: DataBlockStatus;
  current: string;
  latest: string;
  updateAvailable: boolean;
  changelogUrl: string | null;
  hint: string | null;
}

export interface DataSettingsView {
  archive: ArchiveView;
  telemetryOptOut: boolean;
  folders: DataFoldersView;
  version: VersionView;
}

const CAP_FIELDS: readonly Omit<CapFieldView, 'value'>[] = [
  { key: 'daily', label: 'Daily (USD)', placeholder: 'e.g. 10' },
  { key: 'weekly', label: 'Weekly (USD)', placeholder: 'e.g. 50' },
  { key: 'monthly', label: 'Monthly (USD)', placeholder: 'e.g. 200' },
];

export function capGroup(key: CapPlatform, heading: string | null, values: Record<CapPeriod, string>): CapGroupView {
  return { key, heading, fields: CAP_FIELDS.map((field) => ({ ...field, value: values[field.key] })) };
}

export function spendingDescription(withCodex: boolean): string {
  return withCodex
    ? "Separate USD caps per platform: Claude's estimated spend is checked against Claude's caps and Codex's against Codex's, whatever the header shows. The Live usage page shows the caps of the platform in view (under Both, the two added up). Stored locally in your browser; this is a budgeting aid, not a real bill."
    : 'For pay-as-you-go usage — enter caps in USD to see gauges on the Live usage page. Stored locally in your browser; this is a budgeting aid, not a real bill.';
}

export function limitAlertsDescription(withCodex: boolean): string {
  return `Notifies you when a plan's rate limit crosses these thresholds — Claude.ai's 5-hour and weekly limits${
    withCodex ? ", and Codex's 5-hour and weekly windows" : ''
  } — on every page, once per window. Reaching the limit always alerts.`;
}

export function budgetAlertsDescription(withCodex: boolean): string {
  return `Notifies you the first time ${
    withCodex ? "a platform's " : ''
  }spend crosses 70 / 90 / 100% of a spending cap. Caps reset on real day, week and month boundaries.`;
}

// 100% (the limit itself) always alerts, so it is not offered as a toggle.
export const THRESHOLD_CHOICES = [50, 60, 70, 80, 90, 95] as const;

export function toggleThreshold(current: number[], t: number): number[] {
  const next = current.includes(t) ? current.filter((x) => x !== t) : [...current, t];
  return next.length > 0 ? next.sort((a, b) => a - b) : current;
}

export function thresholdViews(config: LimitAlertConfig): ThresholdView[] {
  const choices = [...new Set([...THRESHOLD_CHOICES, ...config.thresholds])].sort((a, b) => a - b);
  return choices.map((value) => ({ value, label: `${value}%`, checked: config.thresholds.includes(value) }));
}

export function detectedModeLabel(detectedMode: 'api' | 'subscription'): string {
  return detectedMode === 'api' ? 'API · pay-as-you-go' : 'Subscription';
}

export function localeWeekStartNote(choice: WeekStartChoice, localeDefault: WeekStart): string | null {
  return choice === 'auto' ? `Locale default: ${localeDefault === 'sunday' ? 'Sunday' : 'Monday'}` : null;
}

export function archiveLine(s: ArchiveSummary): string {
  const size = s.bytes >= 1_048_576 ? `${(s.bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(s.bytes / 1024))} KB`;
  const since = s.oldestTs !== null ? ` · since ${longDateLabel(s.oldestTs)}` : '';
  return `${s.files} archived file${s.files === 1 ? '' : 's'} · ${size}${since}`;
}

export function archiveView(summary: ArchiveSummary | null, loading: boolean, busy: boolean, error: string | null): ArchiveView {
  if (!summary) {
    return { status: loading ? 'loading' : 'error', enabled: false, line: '', canForget: false, busy, error };
  }
  const line =
    summary.files > 0
      ? archiveLine(summary)
      : summary.enabled
        ? 'Nothing archived yet — rows are kept once a transcript is deleted.'
        : 'Nothing archived.';
  return { status: 'ready', enabled: summary.enabled, line, canForget: summary.files > 0, busy, error };
}

export function dataFolders(
  sources: SourcesInfo | null,
  loading: boolean,
  envelopeClaudeDir: string | null,
  codexConfigDir: string | null,
): DataFoldersView {
  if (!sources) return { status: loading ? 'loading' : 'error', rows: [] };
  const rows: DataFolderView[] = [];
  const claudeDir = sources.claudeDir ?? envelopeClaudeDir;
  if (claudeDir) rows.push({ label: 'Claude', path: claudeDir });
  if (sources.cowork?.available && sources.coworkDir) rows.push({ label: 'Cowork', path: sources.coworkDir });
  if (sources.codex?.available) {
    const codexDir = sources.codexDir ?? sources.codex.dir ?? codexConfigDir;
    if (codexDir) rows.push({ label: 'Codex', path: codexDir });
  }
  return { status: 'ready', rows };
}

export function versionView(version: VersionInfo | null, loading: boolean): VersionView {
  if (!version) {
    return { status: loading ? 'loading' : 'error', current: '', latest: '', updateAvailable: false, changelogUrl: null, hint: null };
  }
  return {
    status: 'ready',
    current: `v${version.current}`,
    latest: version.latest ? `v${version.latest}` : 'Unknown',
    updateAvailable: version.updateAvailable,
    changelogUrl: version.changelogUrl || null,
    hint: !version.updateAvailable
      ? null
      : version.isDocker
        ? 'Running in Docker: pull the latest code, then run npm run docker:up to rebuild.'
        : 'Pull the latest code (git pull, then npm install) to update.',
  };
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// `live` is the Codex live-limits poll and `config` the Codex config poll.
export function codexAccountRows(config: CodexConfigData | null, live: CodexLiveData | null): StatusRow[] {
  const rows: StatusRow[] = [];
  const apiKey = config?.authMode === 'apikey';

  rows.push(
    apiKey
      ? { label: 'Plan', value: 'OpenAI API key · pay-as-you-go', tone: 'muted' }
      : live?.planType
        ? { label: 'Plan', value: `ChatGPT ${titleCase(live.planType)} (detected)`, tone: 'ok' }
        : { label: 'Plan', value: 'Not detected', tone: 'muted' },
  );

  if (apiKey) {
    rows.push({ label: 'Token', value: 'API key login', note: 'An API key has no plan windows to read.', tone: 'muted' });
  } else if (config && config.authMode === null) {
    rows.push({ label: 'Token', value: 'Not signed in', note: 'No Codex login found in auth.json.', tone: 'warn' });
  } else if (!live) {
    rows.push({ label: 'Token', value: 'Checking…', note: 'Reading the Codex login.', tone: 'muted' });
  } else if (live.error) {
    const expired = /expired/i.test(live.error);
    rows.push({
      label: 'Token',
      value: expired ? 'Expired' : 'Live limits unavailable',
      note: expired
        ? 'Open the ChatGPT desktop app once — it refreshes its own token. The dashboard never refreshes it.'
        : live.error,
      tone: 'warn',
    });
  } else if (live.origin === 'passive') {
    rows.push({
      label: 'Token',
      value: 'Live read failed · using the newest local snapshot',
      note: live.warning,
      tone: 'warn',
    });
  } else {
    rows.push({ label: 'Token', value: 'OK', note: 'Live plan limits are being read.', tone: 'ok' });
  }

  return rows;
}
