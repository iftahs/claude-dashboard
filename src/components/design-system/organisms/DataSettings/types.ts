import type { DataSettingsView } from '@/lib/views/settings';

export interface DataSettingsProps {
  id: string;
  view: DataSettingsView;
  onForget: () => void;
  onTelemetryChange: (optOut: boolean) => void;
}
