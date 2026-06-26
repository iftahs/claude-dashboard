import type { Limits } from '@/hooks/useLimits';

export interface SettingsTabProps {
  limits: Limits;
  onChangeLimits: (l: Limits) => void;
}
