import { useMemo } from 'react';
import { limitTone } from '@/lib/limits';
import { routesFor } from '@/routes';
import type { RouteGroupId, RouteIcon, RouteId } from '@/routes';
import { useAgentTraffic } from './useAgentTraffic';
import { useLiveMetrics } from './useLiveMetrics';
import { useSource } from './useSource';

export type SidebarBadgeTone = 'neutral' | 'warning' | 'danger';

export interface SidebarTabBadge {
  text: string;
  tone: SidebarBadgeTone;
  title: string;
}

export interface SidebarTab {
  id: RouteId;
  path: string;
  label: string;
  icon: RouteIcon;
  group: RouteGroupId;
  badge?: SidebarTabBadge;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The limit badge stays neutral under 70%, then follows limitTone() (70/90%), the same thresholds as the gauge ring and plan bars.
function limitBadgeTone(pct: number): SidebarBadgeTone {
  const tone = limitTone(pct);
  return tone === 'success' ? 'neutral' : tone;
}

export function useSidebarTabs(): SidebarTab[] {
  const { platform } = useSource();
  const { runningAgentCount, liveWorkflowCount, limitPct, limitTooltip } = useLiveMetrics();
  const { waiting: waitingAgentCount } = useAgentTraffic();

  return useMemo(
    () =>
      routesFor(platform).map((route): SidebarTab => {
        const tab: SidebarTab = { id: route.id, path: route.path, label: route.label, icon: route.icon, group: route.group };
        if (route.id === 'agents') {
          // Waiting wins over running, so "an agent needs you" shows from every page.
          if (waitingAgentCount > 0) {
            tab.badge = {
              text: String(waitingAgentCount),
              tone: 'danger',
              title: `${plural(waitingAgentCount, 'agent')} waiting for your attention`,
            };
          } else if (runningAgentCount > 0) {
            tab.badge = {
              text: String(runningAgentCount),
              tone: 'neutral',
              title: `${plural(runningAgentCount, 'agent')} running right now`,
            };
          }
        } else if (route.id === 'live' && limitPct != null) {
          tab.badge = { text: `${limitPct}%`, tone: limitBadgeTone(limitPct), title: limitTooltip };
        } else if (route.id === 'workflows' && liveWorkflowCount > 0) {
          tab.badge = {
            text: String(liveWorkflowCount),
            tone: 'neutral',
            title: `${plural(liveWorkflowCount, 'workflow')} running right now`,
          };
        }
        return tab;
      }),
    [platform, runningAgentCount, waitingAgentCount, liveWorkflowCount, limitPct, limitTooltip],
  );
}
