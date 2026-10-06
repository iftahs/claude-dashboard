import type { AgentAlertChoice, AlertModeChoice, AlertSettingsView } from '@/lib/views/settings';

export interface AlertSettingsProps {
  id: string;
  view: AlertSettingsView;
  onAgentChange: (mode: AgentAlertChoice) => void;
  onLimitModeChange: (mode: AlertModeChoice) => void;
  onThresholdToggle: (threshold: number) => void;
  onBudgetChange: (mode: AlertModeChoice) => void;
}
