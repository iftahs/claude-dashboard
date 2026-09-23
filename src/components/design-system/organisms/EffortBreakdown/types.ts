import type { EffortData, EffortSlice } from '@/types';

export interface EffortBreakdownProps {
  /** GET /api/usage/effort?days=&source= for the platform on screen. */
  data: EffortData;
}

export interface EffortBarProps {
  slices: EffortSlice[];
  /** Taller bar for the all-models row. */
  size?: 'sm' | 'md';
}
