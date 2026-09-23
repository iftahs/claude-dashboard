import type { InsightsYield } from '@/types';
import type { FunnelStage } from './types';

/**
 * Sessions → in a git repo → committed → opened a PR. Every stage is a count of
 * sessions, drawn against the first stage; the commit RATE is the KPI row's.
 */
export function funnelStages(d: InsightsYield): FunnelStage[] {
  return [
    { key: 'sessions', label: 'Sessions', count: d.sessions, barClass: 'bg-zinc-500', hint: 'Every session in the window.' },
    {
      key: 'repo', label: 'In a git repo', count: d.repoSessions, barClass: 'bg-clay-500',
      hint: 'A git branch or remote was recorded, or the session ran git itself.',
    },
    { key: 'committed', label: 'Committed', count: d.committed, barClass: 'bg-emerald-500', hint: 'Ran a git commit that succeeded.' },
    {
      key: 'pr', label: 'Opened a PR', count: d.prSessions, barClass: 'bg-[#0ea5e9]',
      hint: d.prCount > d.prSessions ? `${d.prCount} pull requests in all.` : 'Opened or linked a pull request.',
    },
  ];
}
