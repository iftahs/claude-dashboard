import { useMemo } from 'react';
import { PlanUsage } from '@/components/design-system/molecules/PlanUsage/PlanUsage';
import { AgentActivity } from '@/components/design-system/organisms/AgentActivity/AgentActivity';
import { CodexDailyCompareChart } from '@/components/design-system/organisms/CodexDailyCompareChart/CodexDailyCompareChart';
import { StatCard } from '@/components/design-system/atoms/StatCard/StatCard';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { Skeleton, StatCardSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { usePolling } from '@/hooks/usePolling';
import { useLiveData } from '@/hooks/useLiveData';
import { useSource } from '@/hooks/useSource';
import { useConfigMode } from '@/hooks/useConfigMode';
import type { ActivityData } from '@/types';
import { isTokenExpired, liveStats, profileStats, snapshotNote, toDisplayAgents, toPlanUsageLive } from './utils';

const COMPARE_DAYS = 30;

const PLAN_HELP =
  "Your ChatGPT plan's Codex rate-limit windows: the 5-hour window and the weekly window, each with % used and time to reset. Read from OpenAI's usage API with the token the ChatGPT desktop app stores locally — surfaced for awareness, never enforced or refreshed by this dashboard.";

const AGENTS_HELP =
  'Live view of Codex threads working right now in the ChatGPT desktop app, with the Guardian auto-review subagents each turn spawns nested beneath, plus recently finished reviews — refreshed every few seconds from the local rollout files. Empty when nothing is running.';

/** Card shown in place of the plan-usage bars when the live limits cannot be read. */
function PlanUnavailable({ error }: { error: string }) {
  const expired = isTokenExpired(error);
  return (
    <div className="card flex h-full flex-col justify-center p-5">
      <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-zinc-300">
        Plan usage
        <InfoTip text={PLAN_HELP} />
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

export function CodexTab() {
  const { codexAvailable } = useSource();
  const { weekStart } = useConfigMode();
  const { codexLive, codexAgents, codexProfile } = useLiveData();

  // Local per-day Codex totals for the server-vs-local comparison. Scoped to
  // source=codex explicitly (not via withSrc) — this panel is Codex-only whatever
  // the header filter says. Disabled entirely when Codex data is absent.
  const activity = usePolling<ActivityData>(
    codexAvailable ? `/api/activity?days=${COMPARE_DAYS}&source=codex` : '',
    60000,
  );

  const live = codexLive.data;
  const liveOk = !!live && !live.error;
  // Either the endpoint returned `{ error }` (token expired, offline…) or the
  // request itself failed (e.g. a backend without the Codex routes → HTTP 404).
  const liveError = live?.error ?? codexLive.error;

  const profile = codexProfile.data;
  const profileOk = !!profile && !profile.error;
  const profileError = profile?.error ?? codexProfile.error;

  // Full cwd → display label, once per poll result (the 2.5s poll returns a new
  // object each tick; re-mapping on every render would churn the card animations).
  const agents = useMemo(() => toDisplayAgents(codexAgents.data), [codexAgents.data]);

  return (
    <>
      {/* Plan windows + live plan/credit/status cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          {liveOk ? (
            <PlanUsage
              block={null}
              weekly={null}
              liveUsage={toPlanUsageLive(live)}
              weekStart={weekStart}
              tier={live.planType}
              help={PLAN_HELP}
              labels={{ block: '5-hour limit', weekly: 'Weekly limit' }}
              note={live.origin === 'passive' ? snapshotNote(live) : undefined}
            />
          ) : liveError ? (
            <PlanUnavailable error={liveError} />
          ) : (
            <div className="card p-5">
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="mt-6 h-3 w-full rounded" />
              <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
              <Skeleton className="mt-6 h-3 w-full rounded" />
              <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
          {liveOk
            ? liveStats(live).map((s) => (
                <StatCard key={s.key} label={s.label} value={s.value} sub={s.sub} help={s.help} accent={s.accent} />
              ))
            : codexLive.loading
              ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
              : null}
        </div>
      </div>

      {/* Server-side profile stats (OpenAI's own numbers — cover every device) */}
      {profileOk ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {profileStats(profile).map((s) => (
            <StatCard key={s.key} label={s.label} value={s.value} sub={s.sub} help={s.help} />
          ))}
        </div>
      ) : codexProfile.loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : profileError ? (
        <p className="text-xs text-zinc-500">
          Profile stats unavailable — {isTokenExpired(profileError) ? 'Codex token expired; open the ChatGPT app.' : profileError}
        </p>
      ) : null}

      {/* Threads + guardian reviews running right now */}
      <AgentActivity
        data={agents}
        loading={codexAgents.loading}
        title="Codex agents · live activity"
        help={AGENTS_HELP}
        labels={{
          mains: 'Codex threads',
          subagents: 'Guardian reviews',
          otherSubagents: 'Other guardian reviews',
          subagentUnit: ['review', 'reviews'],
          mainUnit: ['thread', 'threads'],
          empty: 'No Codex threads running right now',
        }}
      />

      {/* OpenAI's per-day count vs what the local rollouts add up to */}
      <CodexDailyCompareChart
        server={profile?.dailyUsage ?? []}
        local={activity.data?.dailyActivity ?? []}
        loading={codexProfile.loading || activity.loading}
        days={COMPARE_DAYS}
      />

      <p className="text-xs leading-relaxed text-zinc-500">
        <span className="font-semibold text-zinc-400">What this covers:</span> the Codex rollouts the ChatGPT
        desktop app writes under <code className="font-mono text-zinc-400">~/.codex</code> — every thread run on
        this machine, with each turn&apos;s Guardian auto-review folded into its parent thread. Costs elsewhere in the
        dashboard are estimates at OpenAI&apos;s list API prices (a subscription has no per-token bill). Codex
        usage from the mobile and web apps never reaches this machine, so it appears only in the server series
        above.
      </p>
    </>
  );
}
