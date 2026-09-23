import type { InsightsYield } from '@/types';
import type { FunnelStage } from './types';

// Each stage is a subset of the one above, drawn against the first stage; the commit RATE is the KPI row's.
export function funnelStages(d: InsightsYield): FunnelStage[] {
  const prHint =
    (d.prCount > d.prSessions
      ? `Committed and opened or linked a pull request — ${d.prCount} PRs in all.`
      : 'Committed and opened or linked a pull request.') +
    (d.prOnlySessions > 0 ? ` Not counted: ${d.prOnlySessions} that opened a PR without committing.` : '');
  return [
    { key: 'sessions', label: 'Sessions', count: d.sessions, barClass: 'bg-zinc-500', hint: 'Every session in the window.' },
    {
      key: 'repo', label: 'In a git repo', count: d.repoSessions, barClass: 'bg-clay-500',
      hint: 'A git branch or remote was recorded, or the session ran git itself.',
    },
    { key: 'committed', label: 'Committed', count: d.committed, barClass: 'bg-emerald-500', hint: 'Ran a git commit that succeeded.' },
    {
      key: 'pr', label: 'Opened a PR', count: d.prSessions, barClass: 'bg-[#0ea5e9]', hint: prHint,
    },
  ];
}
