import { memo } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { cn } from '@/lib/cn';
import { HEADLINE_CLASS, LARGE_BADGE } from '../utils';
import type { ProjectSessionListProps } from './types';

const ROW_CLASS =
  'flex w-full min-w-0 flex-col gap-0.5 rounded-control px-2 py-1.5 text-left transition-colors duration-fast ease-standard hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus';

export const ProjectSessionList = memo(function ProjectSessionList({ id, label, sessions, more, partialNote, onOpen }: ProjectSessionListProps) {
  return (
    <div id={id} className="flex min-w-0 animate-fade-in flex-col gap-1 rounded-control border border-line bg-surface-sunken p-1">
      <ul aria-label={label} className="flex min-w-0 flex-col">
        {sessions.map((session) => (
          <li key={session.id} className="min-w-0">
            <button type="button" onClick={() => onOpen(session.id)} className={ROW_CLASS}>
              <span className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span dir="auto" title={session.headlineTitle || undefined} className={cn('min-w-0 truncate text-small', HEADLINE_CLASS[session.headlineKind])}>
                    {session.headline}
                  </span>
                  {session.badge ? <Badge tone="info">{session.badge}</Badge> : null}
                  {session.partial ? <Badge title={partialNote ?? undefined}>{LARGE_BADGE}</Badge> : null}
                </span>
                <span className="flex-none whitespace-nowrap font-mono text-mono tabular-nums text-fg">{session.cost}</span>
              </span>
              <span className="truncate font-mono text-mono tabular-nums text-fg-subtle">
                {session.date} · {session.tokens}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {more ? <p className="px-2 text-caption text-fg-subtle">{more}</p> : null}
      {partialNote ? <p className="px-2 pb-1 text-caption text-fg-subtle">{partialNote}</p> : null}
    </div>
  );
});
