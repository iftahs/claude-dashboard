import type { LimitGaugeView } from '@/lib/views/live';

export interface LimitGaugeProps {
  view: LimitGaugeView;
  wideBelowXl?: boolean;
  className?: string;
}
