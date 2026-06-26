import type { LiteLlmSpend } from '@/types';

export interface LiteLlmActualBilledProps {
  spend: LiteLlmSpend;
  /** Gateway hostname (shown in the header), '' to hide. */
  host: string;
  /** Selected Trends window in days (labels the daily breakdown). */
  weekDays: number;
}
