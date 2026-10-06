import { CHART_PROJECTED_FILL } from '@/lib/chart-theme';
import { compact, shortModel, usd } from '@/lib/format';
import { modelColor } from '@/lib/palette';
import type { Bucket } from '@/types';
import type {
  UsageBarFooterLine,
  UsageBarMetric,
  UsageBarModel,
  UsageBarModelInput,
  UsageBarRow,
  UsageBarSeries,
} from './types';

export const DEFAULT_HEIGHT = 260;
export const ANIMATION_MAX_ROWS = 60;
export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const;
export const STACK_ID = 'usage';
export const TODAY_TEXT = 'Today';
export const PROJECTED_TEXT = 'Projected';
export const LEGEND_LABEL = 'Series';

export const ROW_LABEL = '__label';
export const ROW_TITLE = '__title';
export const ROW_COST = '__cost';
export const ROW_TOTAL = '__total';
export const ROW_PROJECTED = '__projected';
export const PROJECTION_KEY = '__projection';

const SYNTHETIC_MODEL = '<synthetic>';
const DAY_MS = 86_400_000;
const PROJECTED_DAYS = 3;
const AXIS_WIDTH: Record<UsageBarMetric, number> = { tokens: 44, cost: 56 };
const LEGEND_INSET: Record<UsageBarMetric, string> = { tokens: 'pl-11', cost: 'pl-14' };

export function formatValue(value: number, metric: UsageBarMetric): string {
  return metric === 'cost' ? usd(value) : compact(value);
}

export function axisWidth(metric: UsageBarMetric): number {
  return AXIS_WIDTH[metric];
}

export function legendInset(metric: UsageBarMetric): string {
  return LEGEND_INSET[metric];
}

function modelValue(bucket: Bucket, model: string, metric: UsageBarMetric): number {
  if (metric === 'cost') return bucket.byModelCost?.[model] ?? 0;
  return (bucket.byModelEffective ?? bucket.byModel)[model] ?? 0;
}

function modelsOf(buckets: readonly Bucket[], metric: UsageBarMetric): string[] {
  const totals = new Map<string, number>();
  for (const bucket of buckets) {
    for (const model of Object.keys(bucket.byModel)) {
      if (model === SYNTHETIC_MODEL) continue;
      totals.set(model, (totals.get(model) ?? 0) + modelValue(bucket, model, metric));
    }
  }
  return [...totals]
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([model]) => model);
}

function nextDay(ms: number): number {
  const date = new Date(ms);
  date.setDate(date.getDate() + 1);
  return date.getTime();
}

function startOfNextMonth(now: number): number {
  const date = new Date(now);
  date.setMonth(date.getMonth() + 1, 1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function buildUsageBars({
  buckets,
  labelFor,
  titleFor,
  metric,
  projectionCostPerDay,
  projectionTokensPerDay,
  now,
}: UsageBarModelInput): UsageBarModel {
  const models = modelsOf(buckets, metric);
  const title = titleFor ?? labelFor;
  const rows: UsageBarRow[] = buckets.map((bucket) => {
    const row: UsageBarRow = {
      [ROW_LABEL]: labelFor(bucket.start),
      [ROW_TITLE]: title(bucket.start),
      [ROW_COST]: bucket.cost,
      [ROW_TOTAL]: bucket.totalTokens,
      [ROW_PROJECTED]: bucket.start > now,
      [PROJECTION_KEY]: 0,
    };
    for (const model of models) row[model] = modelValue(bucket, model, metric);
    return row;
  });

  const last = buckets[buckets.length - 1];
  if (projectionCostPerDay && projectionCostPerDay > 0 && last && Math.abs(last.start - now) < 2 * DAY_MS) {
    const monthEnd = startOfNextMonth(now);
    const tokensPerDay =
      projectionTokensPerDay ?? buckets.reduce((sum, bucket) => sum + bucket.effectiveTokens, 0) / buckets.length;
    let start = nextDay(last.start);
    for (let day = 0; day < PROJECTED_DAYS && start < monthEnd; day += 1) {
      const row: UsageBarRow = {
        [ROW_LABEL]: labelFor(start),
        [ROW_TITLE]: title(start),
        [ROW_COST]: projectionCostPerDay,
        [ROW_TOTAL]: null,
        [ROW_PROJECTED]: true,
        [PROJECTION_KEY]: metric === 'cost' ? projectionCostPerDay : tokensPerDay,
      };
      for (const model of models) row[model] = 0;
      rows.push(row);
      start = nextDay(start);
    }
  }

  const projected = rows.some((row) => row[ROW_PROJECTED] === true);
  const series: UsageBarSeries[] = models.map((model) => ({ key: model, label: shortModel(model), color: modelColor(model) }));
  if (projected) series.push({ key: PROJECTION_KEY, label: PROJECTED_TEXT, color: CHART_PROJECTED_FILL });

  return { rows, series, todayLabel: projected ? labelFor(now) : null };
}

export function footerLines(row: UsageBarRow, metric: UsageBarMetric): UsageBarFooterLine[] {
  if (metric === 'cost') return [];
  const lines: UsageBarFooterLine[] = [];
  const total = row[ROW_TOTAL];
  const cost = row[ROW_COST];
  if (typeof total === 'number' && row[ROW_PROJECTED] !== true) {
    lines.push({ label: 'All tokens incl. cache reads', value: compact(total) });
  }
  if (typeof cost === 'number') lines.push({ label: 'Est. cost', value: `~${usd(cost)}` });
  return lines;
}
