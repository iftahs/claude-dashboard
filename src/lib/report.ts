import type { WeeklyData } from '@/types';
import { localYmd } from './week';
import { shortModel } from './format';

/** Shape ExportButton consumes: a flat CSV table, a structured JSON doc, a slug. */
export interface SpendReport {
  csv: Record<string, unknown>[];
  json: unknown;
  filename: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * On-demand spend report from the selected Trends window (LiteLLM-inspired
 * scheduled reports, minus the scheduling — emailing reports would leave the
 * machine, which the local-first model forbids). CSV = the per-day table; JSON =
 * the full report (summary + per-day + per-model). All figures are estimated
 * equivalent-API cost, since subscription usage has no per-token bill.
 */
export function buildSpendReport(weekly: WeeklyData, weekDays: number, source: string): SpendReport {
  const perDay = weekly.buckets.map((b) => ({
    date: localYmd(b.start),
    costUSD: round2(b.cost),
    effectiveTokens: b.effectiveTokens,
    inputTokens: b.inputTokens,
    outputTokens: b.outputTokens,
    cacheCreateTokens: b.cacheCreateTokens,
    cacheReadTokens: b.cacheReadTokens,
    totalTokens: b.totalTokens,
  }));

  const perModel = weekly.byModel.map((m) => ({
    model: m.model,
    shortModel: shortModel(m.model),
    costUSD: round2(m.cost),
    effectiveTokens: m.effectiveTokens,
    totalTokens: m.totalTokens,
  }));

  const summary = {
    windowDays: weekDays,
    from: localYmd(weekly.rangeFrom),
    to: localYmd(weekly.rangeTo),
    source,
    costBasis: 'estimated-equivalent-api',
    totalCostUSD: round2(weekly.totals.cost),
    avgCostPerDayUSD: round2(weekly.totals.cost / weekDays),
    effectiveTokens: weekly.totals.effectiveTokens,
    totalTokens: weekly.totals.totalTokens,
  };

  return {
    csv: perDay,
    json: { summary, perDay, perModel },
    filename: `spend-report-${weekDays}d`,
  };
}
