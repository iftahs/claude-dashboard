import type { Limits } from '@/hooks/useLimits';
import type { Settings } from '@/hooks/useSettings';
import type { AiConfig } from '@/types';

export interface SettingsViewProps {
  limits: Limits;
  onChangeLimits: (l: Limits) => void;
  settings: Settings;
  onChangeSettings: (s: Settings) => void;
  /** Backend-detected mode, shown in the "Auto" label. */
  detectedMode: 'api' | 'subscription';
  /** Anonymous-analytics opt-out (true = telemetry disabled by this user). */
  analyticsOptOut: boolean;
  onChangeAnalyticsOptOut: (optOut: boolean) => void;
  /** AI Insights provider/model/key (stored client-side). */
  aiConfig: AiConfig;
  onChangeAiConfig: (c: AiConfig) => void;
}
