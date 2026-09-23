import { PlanUsage } from '@/components/design-system/molecules/PlanUsage/PlanUsage';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import type { CodexPlanCardProps } from './types';
import {
  CODEX_PLAN_HELP,
  CODEX_PLAN_LABELS,
  codexModelGates,
  isTokenExpired,
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
 * The Codex rate-limit card: the same PlanUsage molecule the Claude side uses, fed
 * OpenAI's two windows through the adapter plus the premium-model gates, with an
 * unavailable/expired state of its own. Takes the PlanUsage slot on the Live tab,
 * full width under the gauge row, exactly where the Claude card sits.
 */
export function CodexPlanCard({ live, weekStart }: CodexPlanCardProps) {
  const data = live.data;
  const ok = !!data && !data.error;
  // Either the endpoint returned `{ error }` (token expired, offline with no local
  // snapshot…) or the request itself failed (e.g. a backend without the Codex
  // routes → HTTP 404). A passive snapshot carries `warning`, not `error`, and renders.
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
        gates={codexModelGates(data)}
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
