import { useId } from 'react';
import { Button } from '@/components/design-system/atoms/Button/Button';
import { Chip } from '@/components/design-system/atoms/Chip/Chip';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { TranscriptPane } from '@/components/design-system/organisms/TranscriptPane/TranscriptPane';
import { LINES_UNIT, LINK_CLASS, PRS_LABEL, TOOLS_LABEL, TRANSCRIPT_LABEL } from '../utils';
import type { SessionDetailBodyProps } from './types';

export function SessionDetailBody({ view, transcript, onToggleTranscript, onRetryTranscript }: SessionDetailBodyProps) {
  const transcriptId = useId();

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {view.prompt ? (
        <p dir="auto" title={view.prompt} className="line-clamp-2 text-small text-fg-muted">
          “{view.prompt}”
        </p>
      ) : null}

      <div className="grid min-w-0 gap-5 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <GroupLabel as="h3">{view.summaryLabel}</GroupLabel>
            {view.facts.map((fact) => (
              <KeyValueRow
                key={fact.key}
                label={fact.label}
                help={fact.help ?? undefined}
                tone={fact.tone}
                value={
                  fact.changes ? (
                    <span title={fact.value}>
                      {fact.changes.files} · <span className="text-success-fg">{fact.changes.added}</span>{' '}
                      <span className="text-danger-fg">{fact.changes.removed}</span> {LINES_UNIT}
                    </span>
                  ) : (
                    fact.value
                  )
                }
              />
            ))}
          </div>

          {view.prs.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-2">
              <GroupLabel as="h3">{PRS_LABEL}</GroupLabel>
              <ul className="flex min-w-0 flex-wrap gap-1.5">
                {view.prs.map((pr) => (
                  <li key={pr.url} className="flex min-w-0 max-w-full">
                    {pr.href ? (
                      <a href={pr.href} target="_blank" rel="noopener noreferrer" title={pr.url} className={LINK_CLASS}>
                        <span className="min-w-0 truncate">{pr.label}</span>
                        <Icon name="externalLink" size={12} className="flex-none" />
                      </a>
                    ) : (
                      <Chip title={pr.url}>{pr.label}</Chip>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <GroupLabel as="h3">{TOOLS_LABEL}</GroupLabel>
          {view.tools.length > 0 ? (
            <ul className="flex min-w-0 flex-wrap gap-1.5">
              {view.tools.map((tool) => (
                <li key={tool.name} className="flex min-w-0 max-w-full">
                  <Chip title={tool.name} className="min-w-0 max-w-full flex-initial">
                    <span className="flex-none tabular-nums text-fg">{tool.count}</span>
                    <span className="min-w-0 truncate">{tool.label}</span>
                  </Chip>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-fg-muted">{view.toolsEmpty}</p>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 border-t border-line pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={transcript.open}
            aria-controls={transcript.open ? transcriptId : undefined}
            onClick={onToggleTranscript}
            className="-ml-2.5"
          >
            <Icon name={transcript.open ? 'chevronDown' : 'chevronRight'} />
            {TRANSCRIPT_LABEL}
          </Button>
          {transcript.count ? <span className="whitespace-nowrap text-caption text-fg-subtle">{transcript.count}</span> : null}
        </div>
        {transcript.open ? <TranscriptPane id={transcriptId} view={transcript} onRetry={onRetryTranscript} /> : null}
      </div>
    </div>
  );
}
