import type { ReactNode } from 'react';
import type { ActiveBlock, WeeklyData, LiveUsageData } from '@/types';
import type { WeekStart } from '@/lib/week';

/** Row labels for the two rate-limit windows. Defaults are the Claude.ai strings. */
export interface PlanUsageLabels {
  /** The short (5-hour) window row. Default: "5-hour limit". */
  block?: string;
  /** The long (weekly) window row. Default: "Weekly · all models". */
  weekly?: string;
}

// A gate, not a meter — the provider only says whether the model can run right now (Codex premium models).
export interface PlanGateRow {
  label: string;
  status: string;
  tone: 'ok' | 'muted' | 'danger';
}

export interface PlanUsageProps {
  block: ActiveBlock | null;
  weekly: WeeklyData | null;
  /** Live limits. Its `seven_day_breakdown`, when present (Claude.ai), adds the weekly split by surface. */
  liveUsage?: LiveUsageData | null;
  /** First day of the week — drives the weekly-reset countdown fallback. */
  weekStart: WeekStart;
  /** Plan / rate-limit tier label (e.g. "max_20x") shown as the source of these ceilings. */
  tier?: string | null;
  /** Multi-account mode: the account's email/label, shown as the card title. */
  accountLabel?: string | null;
  /** Highlight ring for the account currently in the shared credential slot. */
  active?: boolean;
  /** InfoTip text next to the title. Defaults to the Claude.ai rate-limit explanation. */
  help?: ReactNode;
  /** Window row labels. Defaults to the Claude.ai strings so existing callers are unchanged. */
  labels?: PlanUsageLabels;
  /** Per-model gate rows, after the per-model weekly bars (Codex premium models). */
  gates?: PlanGateRow[];
  /** Optional footnote under the bars (e.g. "passive snapshot · 3h old"). */
  note?: ReactNode;
}
