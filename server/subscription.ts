const ULTRA = /ultra/i;

export interface SubscriptionInfo {
  subscriptionType: string | null;
  rateLimitTier: string | null;
  seatTier: string | null;
  hasExtraUsageEnabled: boolean;
  email: string | null;
}

/**
 * Classify a live OAuth `/profile` response into plan/tier fields, falling back
 * to the values baked into the local credential blob when the profile is
 * unavailable (offline / expired token → pass `null`). Shared by `/api/config`
 * and `/api/accounts/live` so the has_claude_max / 5x / team / … rules live once.
 */
export function classifySubscription(
  profile: any,
  fallback: { subscriptionType?: string | null; rateLimitTier?: string | null },
): SubscriptionInfo {
  let subscriptionType: string | null = fallback.subscriptionType ?? null;
  let rateLimitTier: string | null = fallback.rateLimitTier ?? null;
  const account = profile?.account ?? {};
  const org = profile?.organization ?? {};
  const tier = String(org.rate_limit_tier ?? '');
  if (account.has_claude_max) {
    subscriptionType = /20x/.test(tier) ? 'max_20x' : /5x/.test(tier) ? 'max_5x' : 'max';
  } else if (account.has_claude_pro) {
    subscriptionType = 'pro';
  } else if (/team/i.test(String(org.organization_type))) {
    subscriptionType = 'team';
  } else if (/enterprise/i.test(String(org.organization_type))) {
    subscriptionType = 'enterprise';
  } else if (account.uuid) {
    subscriptionType = 'free';
  }
  if (org.rate_limit_tier) rateLimitTier = org.rate_limit_tier;
  // The live profile's tier decides; the credential blob's values count only when there is no profile.
  if (ULTRA.test(tier) || (!profile && ULTRA.test(`${subscriptionType ?? ''} ${rateLimitTier ?? ''}`))) subscriptionType = 'ultra';
  return {
    subscriptionType,
    rateLimitTier,
    seatTier: org.seat_tier ?? null,
    hasExtraUsageEnabled: !!org.has_extra_usage_enabled,
    email: account.email ?? account.email_address ?? null,
  };
}
