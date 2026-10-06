import type { GeneralSettingsView, UsageModeChoice } from '@/lib/views/settings';

export interface GeneralSettingsProps {
  id: string;
  view: GeneralSettingsView;
  onModeChange: (mode: UsageModeChoice) => void;
}
