import type { AiSettingsView } from '@/lib/views/settings';

export interface AiSettingsProps {
  id: string;
  view: AiSettingsView;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onKeyChange: (key: string) => void;
  onToggleKeyShown: () => void;
  onSaveKey: () => void;
  onClearKey: () => void;
}
