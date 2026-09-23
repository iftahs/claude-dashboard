import { usd } from '@/lib/format';
import type { CodexLiveData, LiveExtraUsage, LiveSpend } from '@/types';
import type { ExtraUsageView } from './types';

/** Anthropic reports extra-usage/spend amounts in minor units (e.g. cents); divide by 10^exponent for dollars. */
export function toMajorUnits(amountMinor: number | null | undefined, exponent: number | null | undefined): number | null {
  if (amountMinor == null) return null;
  return amountMinor / Math.pow(10, exponent ?? 2);
}

const DISABLED_REASON_LABELS: Record<string, string> = {
  out_of_credits: "Your organization's pre-purchased usage credits have run out.",
};

/** Humanize a `disabled_reason` code from the live extra-usage payload. */
export function disabledReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return DISABLED_REASON_LABELS[reason] ?? reason.replace(/_/g, ' ');
}

/** Anthropic sends `disclaimer` as plain text with an optional trailing `[label](url)` markdown link. */
export function parseDisclaimer(disclaimer: string | null | undefined): { text: string; linkText: string | null; href: string | null } {
  if (!disclaimer) return { text: '', linkText: null, href: null };
  const match = /\[([^\]]+)\]\(([^)]+)\)/.exec(disclaimer);
  if (!match) return { text: disclaimer, linkText: null, href: null };
  return { text: disclaimer.slice(0, match.index).trim(), linkText: match[1], href: match[2] };
}

export function extraUsageBarColor(pct: number): string {
  if (pct > 90) return '#ef4444';
  if (pct > 70) return '#f59e0b';
  return '#10b981';
}

const PAUSES = 'usage pauses at your plan limit until the next reset.';

/**
 * Anthropic's "extra usage": pay standard API rates once the plan limit is hit.
 * Disabled copy, most specific first: the user switched it off, else an org-level
 * reason, else the org never enabled it.
 */
export function claudeExtraUsageView(extraUsage: LiveExtraUsage, spend: LiveSpend | null | undefined, orgEnabled: boolean): ExtraUsageView {
  const used = toMajorUnits(extraUsage.used_credits, extraUsage.decimal_places);
  const limit = toMajorUnits(extraUsage.monthly_limit, extraUsage.decimal_places);
  const pct = extraUsage.utilization != null
    ? Math.round(extraUsage.utilization)
    : limit ? Math.round(((used ?? 0) / limit) * 100) : null;
  const disabledCopy = extraUsage.user_disabled
    ? `You turned extra usage off — ${PAUSES}`
    : orgEnabled
      ? (disabledReasonLabel(extraUsage.disabled_reason) ?? `Not currently available — ${PAUSES}`)
      : `Your organization hasn't enabled extra usage — ${PAUSES}`;
  const disclaimer = parseDisclaimer(spend?.disclaimer);
  return {
    title: 'Extra usage',
    help: "Once you hit your plan's included limit, extra usage bills at standard API rates from your organization's pre-purchased credit pool (if your admin has enabled it).",
    enabled: extraUsage.is_enabled,
    usage: { label: 'This month', value: used != null ? usd(used) : '—', limit: limit != null ? usd(limit) : null, pct },
    disabledCopy,
    disclaimer: disclaimer.text || disclaimer.linkText ? disclaimer : undefined,
  };
}

/**
 * ChatGPT credits for Codex: purchased credits keep Codex running once a plan
 * window is exhausted; reset credits clear a window early. Null when the payload
 * reports neither.
 */
export function codexCreditsView(live: CodexLiveData): ExtraUsageView | null {
  const c = live.credits;
  const rc = live.resetCredits;
  if (!c && !rc) return null;
  const enabled = !!c && (c.hasCredits || c.unlimited);
  const rows: NonNullable<ExtraUsageView['rows']> = [];
  if (rc) {
    rows.push({ label: 'Reset credits', value: `${rc.available} available · ${rc.applicable} applicable now` });
  }
  if (c?.overageLimitReached) rows.push({ label: 'Overage limit', value: 'reached', tone: 'danger' });
  return {
    title: 'Credits',
    help: 'ChatGPT credits keep Codex running once a plan window is exhausted, billed per use. Reset credits clear a rate-limit window early; "applicable now" counts the ones the current window accepts.',
    enabled,
    usage: { label: 'Balance', value: c?.unlimited ? 'Unlimited' : (c?.balance ?? '—'), limit: null, pct: null },
    disabledCopy: c ? `No credits on this account — ${PAUSES}` : 'Credits not reported for this plan.',
    rows,
  };
}
