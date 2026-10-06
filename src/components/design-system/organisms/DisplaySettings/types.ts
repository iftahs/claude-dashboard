import type { DisplaySettingsView, ThemeChoice, WeekStartChoice } from '@/lib/views/settings';

export interface DisplaySettingsProps {
  id: string;
  view: DisplaySettingsView;
  onWeekStartChange: (weekStart: WeekStartChoice) => void;
  onThemeChange: (theme: ThemeChoice) => void;
}
