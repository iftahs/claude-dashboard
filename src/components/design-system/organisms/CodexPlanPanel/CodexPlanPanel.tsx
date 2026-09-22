import { PlanUsage } from '@/components/design-system/molecules/PlanUsage/PlanUsage';
import { StatCard } from '@/components/design-system/atoms/StatCard/StatCard';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { Skeleton, StatCardSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import type { CodexPlanCardProps, CodexPlanPanelProps, CodexPlanStatsProps } from './types';
import {
  CODEX_PLAN_HELP,
  CODEX_PLAN_LABELS,
  compactStats,
  isTokenExpired,
  liveStats,
  profileStats,
  snapshotNote,
  toPlanUsageLive,
} from './utils';

/** Card shown in place of the plan-usage bars when the live limits cannot be read. */
function PlanUnavailable({ error }: { error: string }) {
  const expired = isTokenExpired(error);
  return (
    <div className="card flex h-full flex-col justify-center p-5">
      <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-zinc-300">
        Plan usage
        <InfoTip text={CODEX_PLAN_HELP} />
      </h3>
      <p className={`mt-3 text-sm font-semibold ${expired ? 'text-amber-300' : 'text-zinc-300'}`}>
        {expired ? 'Codex token expired' : 'Codex live limits unavailable'}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        {expired
          ? 'Open the ChatGPT desktop app once — it refreshes its own token and this card recovers on the next poll. The dashboard never refreshes tokens itself.'
          : error}
      </p>
    </div>
  );
}

/**
 * The Codex rate-limit card: the same PlanUsage molecule the Claude side uses,
 * fed OpenAI's two windows through the adapter, with an unavailable/expired state
 * of its own. Sits in the BlockGauge slot on the Live tab (BlockGauge itself is
 * Anthropic-specific — its alerts talk about the "Claude block").
 */
export function CodexPlanCard({ live, weekStart }: CodexPlanCardProps) {
  const data = live.data;
  const ok = !!data && !data.error;
  // Either the endpoint returned `{ error }` (token expired, offline…) or the
  // request itself failed (e.g. a backend without the Codex routes → HTTP 404).
  const error = data?.error ?? live.error;

  if (ok) {
    return (
      <PlanUsage
        block={null}
        weekly={null}
        liveUsage={toPlanUsageLive(data)}
        weekStart={weekStart}
        tier={data.planType}
        help={CODEX_PLAN_HELP}
        labels={CODEX_PLAN_LABELS}
        note={data.origin === 'passive' ? snapshotNote(data) : undefined}
      />
    );
  }
  if (error) return <PlanUnavailable error={error} />;
  return (
    <div className="card p-5">
      <Skeleton className="h-3 w-32 rounded" />
      <Skeleton className="mt-6 h-3 w-full rounded" />
      <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
      <Skeleton className="mt-6 h-3 w-full rounded" />
      <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
    </div>
  );
}

/**
 * The stat cards beside/below the card: four live plan/credit/status figures from
 * the local token, then six server-side lifetime figures from OpenAI's profile
 * endpoint (they cover mobile and web usage this machine never sees). In compact
 * mode the ten collapse to one 2x2 of the four that carry the most information.
 */
export function CodexPlanStats({ live, profile, compact: isCompact }: CodexPlanStatsProps) {
  const liveData = live.data;
  const liveOk = !!liveData && !liveData.error;
  const profileData = profile.data;
  const profileOk = !!profileData && !profileData.error;
  const profileError = profileData?.error ?? profile.error;

  if (isCompact) {
    const stats = compactStats(liveData, profileData);
    if (!stats.length) {
      return live.loading || profile.loading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : null;
    }
    return (
      <div className="grid grid-cols-2 gap-4">
        {stats.map((s) => (
          <StatCard key={s.key} label={s.label} value={s.value} sub={s.sub} help={s.help} accent={s.accent} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {liveOk
          ? liveStats(liveData).map((s) => (
              <StatCard key={s.key} label={s.label} value={s.value} sub={s.sub} help={s.help} accent={s.accent} />
            ))
          : live.loading
            ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            : null}
      </div>

      {/* Server-side profile stats (OpenAI's own numbers — cover every device) */}
      {profileOk ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {profileStats(profileData).map((s) => (
            <StatCard key={s.key} label={s.label} value={s.value} sub={s.sub} help={s.help} />
          ))}
        </div>
      ) : profile.loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : profileError ? (
        <p className="text-xs text-zinc-500">
          Profile stats unavailable —{' '}
          {isTokenExpired(profileError) ? 'Codex token expired; open the ChatGPT app.' : profileError}
        </p>
      ) : null}
    </>
  );
}

/** Card + stats together — the whole Codex plan surface in one block. */
export function CodexPlanPanel({ live, profile, weekStart, compact: isCompact }: CodexPlanPanelProps) {
  return (
    <div className="space-y-4">
      <CodexPlanCard live={live} weekStart={weekStart} />
      <CodexPlanStats live={live} profile={profile} compact={isCompact} />
    </div>
  );
}
