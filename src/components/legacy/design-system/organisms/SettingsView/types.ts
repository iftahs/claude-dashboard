import type { CapPlatform, Limits, PlatformLimits } from '@/lib/limits';
import type { Settings } from '@/hooks/useSettings';
import type { AiConfig, ArchiveSummary } from '@/types';
import type { StatusRow } from '@/lib/views/settings';

/** The history-archive row: GET /api/archive + the forget action. */
export interface ArchiveView {
  summary: ArchiveSummary | null;
  busy: boolean;
  error: string | null;
  onForget: () => void;
}

export interface SettingsViewProps {
  /** Spending caps per platform (Codex null until set). */
  limits: PlatformLimits;
  onChangeLimits: (platform: CapPlatform, l: Limits | null) => void;
  settings: Settings;
  onChangeSettings: (s: Settings) => void;
  /** Backend-detected mode, shown in the "Auto" label. */
  detectedMode: 'api' | 'subscription';
  /** Null when this machine has no Codex data — every Codex control is then hidden. */
  codex: StatusRow[] | null;
  archive: ArchiveView;
  /** Anonymous-analytics opt-out (true = telemetry disabled by this user). */
  analyticsOptOut: boolean;
  onChangeAnalyticsOptOut: (optOut: boolean) => void;
  /** AI Insights provider/model/key (stored client-side). */
  aiConfig: AiConfig;
  onChangeAiConfig: (c: AiConfig) => void;
}
