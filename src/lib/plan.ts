type Raw = string | null | undefined;

const SEAT = /premium|standard/i;

function words(raw: string): string {
  const text = raw.trim().replace(/[_-]+/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Anthropic's current plan name for a Claude account: Free, Pro, Max, Ultra, or Team / Enterprise with the seat tier. Labels only; the stored keys stay as they are. */
export function claudePlanLabel(subscriptionType: Raw, rateLimitTier: Raw, seatTier?: Raw): string | null {
  const type = subscriptionType ?? '';
  const tier = rateLimitTier ?? '';
  const org = /team|enterprise/i.exec(type)?.[0];
  if (org) {
    const seat = SEAT.exec(seatTier ?? '')?.[0];
    return `${words(org)}${seat ? ` ${words(seat)}` : ''}`;
  }
  const both = `${type} ${tier}`;
  if (/ultra|20x/i.test(both)) return 'Ultra';
  if (/max/i.test(both)) return 'Max';
  if (/pro/i.test(both)) return 'Pro';
  if (/free/i.test(both)) return 'Free';
  const fallback = type || tier;
  return fallback.trim() ? words(fallback) : null;
}

const TIER_LABELS: [RegExp, string][] = [
  [/ultra|20x/i, 'Ultra · 10× Pro weekly'],
  [/max|5x/i, 'Max · 5× Pro'],
];

/** A rate limit tier key (such as default_claude_max_20x, from before the Ultra rename) in current plan terms. */
export function claudeRateTierLabel(rateLimitTier: Raw, subscriptionType?: Raw): string | null {
  const tier = rateLimitTier?.trim();
  if (!tier) return null;
  const known = TIER_LABELS.find(([pattern]) => pattern.test(tier));
  if (known) return known[1];
  // default_claude_ai is the shared base tier, so the subscription names it.
  return claudePlanLabel(subscriptionType, tier.replace(/^default_claude_(ai$)?/i, '')) ?? 'Standard';
}
