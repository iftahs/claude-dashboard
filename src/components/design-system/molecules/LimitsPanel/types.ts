import type { Limits } from '@/hooks/useLimits';

export interface LimitsPanelProps {
  limits: Limits;
  onChange: (l: Limits) => void;
  onClose: () => void;
}
