import type { EffortSliceView } from '@/lib/views/models';

export interface EffortSliceListProps {
  title: string;
  slices: readonly EffortSliceView[];
}
