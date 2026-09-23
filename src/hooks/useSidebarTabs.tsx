import { useMemo } from 'react';
import { SidebarBadge } from '@/components/design-system/atoms/SidebarBadge/SidebarBadge';
import type { SidebarTab } from '@/components/design-system/organisms/Sidebar/types';
import { limitTone } from '@/lib/limits';
import { useLiveMetrics } from './useLiveMetrics';
import { useAgentTraffic } from './useAgentTraffic';

interface TabDef {
  id: string;
  icon: string;
  label: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Decorates the static tab list with live trailing badges (running agents, the
 * binding rate-limit window, running workflows). Badge JSX lives in the
 * SidebarBadge atom — no inline pill markup. The limit badge takes its tone from
 * limitTone() (70 / 90 %), the same thresholds as the gauge ring and the plan bars.
 */
export function useSidebarTabs(tabs: TabDef[]): SidebarTab[] {
  const { runningAgentCount, liveWorkflowCount, limitPct, limitTooltip } = useLiveMetrics();
  const { waiting: waitingAgentCount } = useAgentTraffic();

  return useMemo(
    () =>
      tabs.map((t): SidebarTab => {
        if (t.id === 'agents') {
          // Red takes priority — surface "an agent needs you" from any tab.
          if (waitingAgentCount > 0) {
            return {
              ...t,
              badge: (
                <SidebarBadge
                  tone="danger"
                  pulse
                  label={waitingAgentCount}
                  title={`${plural(waitingAgentCount, 'agent')} waiting for your attention`}
                />
              ),
            };
          }
          if (runningAgentCount > 0) {
            return {
              ...t,
              badge: (
                <SidebarBadge
                  tone="clay"
                  pulse
                  label={runningAgentCount}
                  title={`${plural(runningAgentCount, 'agent')} running right now`}
                />
              ),
            };
          }
        }
        // The binding rate-limit window for the platform(s) on screen — the fullest
        // 5-hour or weekly window, 100% once one is reached (see useLiveMetrics).
        if (t.id === 'live' && limitPct != null) {
          return {
            ...t,
            badge: <SidebarBadge tone={limitTone(limitPct)} label={`${limitPct}%`} title={limitTooltip} />,
          };
        }
        if (t.id === 'workflows' && liveWorkflowCount > 0) {
          return {
            ...t,
            badge: (
              <SidebarBadge
                tone="clay"
                pulse
                label={liveWorkflowCount}
                title={`${plural(liveWorkflowCount, 'workflow')} running right now`}
              />
            ),
          };
        }
        return { ...t };
      }),
    [tabs, runningAgentCount, waitingAgentCount, liveWorkflowCount, limitPct, limitTooltip],
  );
}
