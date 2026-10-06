import type { ContribRange, LimitContributorsView } from '@/lib/views/live';

export interface LimitContributorsProps {
  view: LimitContributorsView;
  onRangeChange: (key: string, range: ContribRange) => void;
  className?: string;
}
