import type { TagSliceView } from '@/lib/views/sessions';

export interface TagBreakdownTooltipItem {
  payload?: Partial<TagSliceView>;
}

export interface TagBreakdownTooltipProps {
  active?: boolean;
  payload?: readonly TagBreakdownTooltipItem[];
}
