import type { Limits } from '@/hooks/useLimits';
import type { Settings } from '@/hooks/useSettings';

export interface SettingsModalProps {
  limits: Limits;
  onChangeLimits: (l: Limits) => void;
  settings: Settings;
  onChangeSettings: (s: Settings) => void;
  /** Backend-detected mode, shown in the "Auto" label. */
  detectedMode: 'api' | 'subscription';
  /** Anonymous-analytics opt-out (true = telemetry disabled by this user). */
  analyticsOptOut: boolean;
  onChangeAnalyticsOptOut: (optOut: boolean) => void;
  onClose: () => void;
}
