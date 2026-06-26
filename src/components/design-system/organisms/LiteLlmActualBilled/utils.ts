import type { LiteLlmSpend } from '@/types';

export interface BilledSummary {
  daily: LiteLlmSpend['daily'];
  windowTotal: number;
  prev: number;
  monthDelta: number | null;
  fail: number;
  successPct: number | null;
  tok: LiteLlmSpend['monthTokens'];
  tokTotal: number;
  tokPct: (n: number) => string;
}

/** Roll up a gateway spend report into the figures the billed card renders. */
export function computeBilledSummary(spend: LiteLlmSpend): BilledSummary {
  const daily = spend.daily;
  const windowTotal = daily.reduce((s, d) => s + d.cost, 0);
  const prev = spend.prevMonthToDate;
  const monthDelta = prev > 0 ? Math.round(((spend.monthToDate - prev) / prev) * 100) : null;
  const fail = spend.monthFailed;
  const reqTotal = spend.monthSuccessful + fail;
  const successPct = reqTotal > 0 ? (spend.monthSuccessful / reqTotal) * 100 : null;
  const tok = spend.monthTokens;
  const tokTotal = tok.prompt + tok.completion + tok.cacheRead + tok.cacheCreate;
  const tokPct = (n: number) => (tokTotal > 0 ? `${(n / tokTotal) * 100}%` : '0%');
  return { daily, windowTotal, prev, monthDelta, fail, successPct, tok, tokTotal, tokPct };
}
