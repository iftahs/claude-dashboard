import { useLiveData } from './useLiveData';
import { useConfigMode } from './useConfigMode';
import { localYmd, startOfWeek } from '../lib/week';
import type { LiteLlmSpend } from '../types';

/** Real billed cost slices for the Live-tab spend widgets / daily-cap ring. */
export interface LiteLlmActual {
  today: number;
  week: number;
  month: number;
  note: string;
}

export interface LiteLlmActualResult {
  /** Raw gateway spend report, or null on error / not-yet-loaded. */
  litellmSpend: LiteLlmSpend | null;
  litellmActual: LiteLlmActual | null;
}

/**
 * Actual billed spend from the LiteLLM gateway. Both values are null when no
 * gateway is configured or the report errored, so callers can hide the cards and
 * the dashboard degrades gracefully. Today = the most recent daily entry;
 * week = the current calendar week (per the user's first-day-of-week preference).
 */
export function useLiteLlmActual(): LiteLlmActualResult {
  const { litellm } = useLiveData();
  const { litellmAvailable, litellmHost, weekStart } = useConfigMode();

  const litellmSpend = litellm.data && !('error' in litellm.data) ? litellm.data : null;
  const weekFromYmd = localYmd(startOfWeek(Date.now(), weekStart));
  const litellmActual =
    litellmAvailable && litellmSpend
      ? {
          today: litellmSpend.daily[litellmSpend.daily.length - 1]?.cost ?? 0,
          week: litellmSpend.daily.reduce((s, d) => (d.date >= weekFromYmd ? s + d.cost : s), 0),
          month: litellmSpend.monthToDate,
          note: litellmHost ? `actual · via ${litellmHost}` : 'actual billed',
        }
      : null;

  return { litellmSpend, litellmActual };
}
