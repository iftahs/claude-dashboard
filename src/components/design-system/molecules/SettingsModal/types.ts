import type { Limits } from '@/hooks/useLimits';
import type { Settings } from '@/hooks/useSettings';

export interface SettingsModalProps {
  limits: Limits;
  onChangeLimits: (l: Limits) => void;
  settings: Settings;
  onChangeSettings: (s: Settings) => void;
  /** Backend-detected mode, shown in the "Auto" label. */
  detectedMode: 'api' | 'subscription';
  onClose: () => void;
}
