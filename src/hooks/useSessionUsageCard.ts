import { useEffect, useMemo, useState } from 'react';
import { useConfigMode } from './useConfigMode';
import { useLiveData } from './useLiveData';
import { useSessionUsage } from './useSessionUsage';
import { claudePlanLabel } from '@/lib/plan';
import { buildClaudePlans, buildCodexPlan, type PlanLimitRowView } from '@/lib/views/live';
import {
  buildSessionUsage,
  buildSessionUsagePicker,
  recentSessions,
  type SessionUsageView,
} from '@/lib/views/session-usage';
import type { SessionMeta } from '@/types';

export interface SessionUsageCard {
  view: SessionUsageView;
  onSessionChange: (sessionId: string) => void;
}

const TICK_MS = 60_000;
const NO_LIMIT_ROWS: readonly PlanLimitRowView[] = [];

// The newest session by default, any of the ten most recent on request; limits are the live windows of that session's platform.
export function useSessionUsageCard(
  sessions: SessionMeta[] | null | undefined,
  sessionsError: string | null,
  enabled = true,
): SessionUsageCard {
  const { liveUsage, codexLive } = useLiveData();
  const { configData, weekStart, isApi, modeKnown } = useConfigMode();

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((count) => count + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const [pickedSession, setPickedSession] = useState<string | null>(null);
  const recentList = useMemo(() => recentSessions(sessions), [sessions]);
  const session = recentList.find((s) => s.session_id === pickedSession) ?? recentList[0] ?? null;
  const sessionId = session?.session_id ?? null;
  const poll = useSessionUsage(enabled ? sessionId : null);

  const codexSession = session?.source === 'codex';
  const plan = claudePlanLabel(configData?.subscriptionType, configData?.rateLimitTier, configData?.seatTier);
  const limits = useMemo(() => {
    const now = Date.now();
    const cards = codexSession
      ? [buildCodexPlan({ live: codexLive.data, failed: codexLive.error, weekStart, now })]
      : modeKnown && !isApi
        ? buildClaudePlans({
            accounts: [],
            live: liveUsage.data,
            liveLoading: liveUsage.loading,
            block: null,
            weeklyEffective: null,
            plan,
            weekStart,
            now,
          })
        : [];
    return cards.find((card) => !card.estimate && !card.state && card.rows.length > 0)?.rows ?? NO_LIMIT_ROWS;
  }, [codexSession, codexLive.data, codexLive.error, modeKnown, isApi, liveUsage.data, liveUsage.loading, plan, weekStart, tick]);

  const view = useMemo(
    () =>
      buildSessionUsage({
        data: poll.data,
        error: poll.error ?? (sessions ? null : sessionsError),
        sessionId,
        pending: !sessions,
        limits,
        picker: buildSessionUsagePicker(recentList, sessionId),
      }),
    [poll.data, poll.error, sessions, sessionsError, sessionId, limits, recentList],
  );

  return { view, onSessionChange: setPickedSession };
}
