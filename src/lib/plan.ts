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
