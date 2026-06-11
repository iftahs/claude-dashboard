/** Human label for the OAuth subscriptionType values Claude Code writes to .credentials.json. */
export function formatPlan(subscriptionType: string | null | undefined): string {
  if (!subscriptionType) return 'free';
  const t = subscriptionType.toLowerCase();
  if (t === 'pro') return 'Pro';
  if (t === 'max') return 'Max';
  if (/max.?5/.test(t)) return 'Max 5x';
  if (/max.?20/.test(t)) return 'Max 20x';
  if (t === 'enterprise') return 'Enterprise';
  if (t === 'team') return 'Team';
  return subscriptionType;
}
