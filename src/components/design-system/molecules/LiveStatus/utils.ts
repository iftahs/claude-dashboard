import type { StatusDotTone } from '@/components/design-system/atoms/StatusDot/types';
import type { LiveStatusState } from './types';

export const LIVE_STATUS: Record<LiveStatusState, { tone: StatusDotTone; label: string; pulse: boolean }> = {
  live: { tone: 'success', label: 'Live', pulse: true },
  paused: { tone: 'neutral', label: 'Paused', pulse: false },
  error: { tone: 'danger', label: 'Offline', pulse: false },
};
