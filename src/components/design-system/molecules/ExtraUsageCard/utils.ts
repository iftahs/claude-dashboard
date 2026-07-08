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
