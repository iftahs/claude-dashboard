import { useMemo } from 'react';
import { SidebarBadge } from '@/components/design-system/atoms/SidebarBadge/SidebarBadge';
import type { SidebarBadgeTone } from '@/components/design-system/atoms/SidebarBadge/types';
import type { SidebarTab } from '@/components/design-system/organisms/Sidebar/types';
import { useLiveMetrics } from './useLiveMetrics';

interface TabDef {
  id: string;
  icon: string;
  label: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// 5-hour utilization → traffic-light tone (matches the Live gauge thresholds).
function usageTone(pct: number): SidebarBadgeTone {
  if (pct >= 80) return 'danger';
  if (pct >= 50) return 'warning';
  return 'success';
}

/**
 * Decorates the static tab list with live trailing badges (running agents,
 * 5-hour utilization, running workflows). Badge JSX lives in the SidebarBadge
 * atom — no inline pill markup.
 */
export function useSidebarTabs(tabs: TabDef[]): SidebarTab[] {
  const { runningAgentCount, liveWorkflowCount, fiveHourPct } = useLiveMetrics();

  return useMemo(
    () =>
      tabs.map((t): SidebarTab => {
        if (t.id === 'agents' && runningAgentCount > 0) {
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
        if (t.id === 'live' && fiveHourPct != null) {
          return {
            ...t,
            badge: (
              <SidebarBadge
                tone={usageTone(fiveHourPct)}
                label={`${fiveHourPct}%`}
                title={`5-hour limit: ${fiveHourPct}% used`}
              />
            ),
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
    [tabs, runningAgentCount, liveWorkflowCount, fiveHourPct],
  );
}
