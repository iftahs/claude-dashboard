import type { EffortBreakdownView } from '@/lib/views/models';

export interface EffortBreakdownProps {
  view: EffortBreakdownView;
  className?: string;
}

export interface EffortLegendItem {
  key: string;
  label: string;
  color: string;
  value: string;
}
