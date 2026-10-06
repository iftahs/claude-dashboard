import type { CapPlatform } from '@/lib/limits';
import type { CapPeriod, SpendingCapsSettingsView } from '@/lib/views/settings';

export interface SpendingCapsSettingsProps {
  id: string;
  view: SpendingCapsSettingsView;
  onChange: (platform: CapPlatform, period: CapPeriod, value: string) => void;
  onSave: (platform: CapPlatform) => void;
  onClear: (platform: CapPlatform) => void;
}
