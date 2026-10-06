import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { ErrorState } from '@/components/design-system/molecules/ErrorState/ErrorState';
import { SkeletonPreset } from '@/components/design-system/molecules/SkeletonPreset/SkeletonPreset';
import { cn } from '@/lib/cn';
import { DETAIL_EMPTY, DETAIL_ERROR_TITLE, DETAIL_SKELETON_ROWS, FOCUS_RING } from '../utils';
import { WorkflowFact } from '../WorkflowFact/WorkflowFact';
import { WorkflowToolBar } from '../WorkflowToolBar/WorkflowToolBar';
import type { WorkflowAgentDetailProps } from './types';

export function WorkflowAgentDetail({ detail, onRetry }: WorkflowAgentDetailProps) {
  return (
    <div className="mx-3 mb-2 flex min-w-0 flex-col gap-3 rounded-control border border-line bg-surface-sunken px-4 py-3">
      {detail.status === 'loading' ? <SkeletonPreset variant="bars" rows={DETAIL_SKELETON_ROWS} /> : null}

      {detail.status === 'error' ? (
        <ErrorState title={DETAIL_ERROR_TITLE} description={detail.error} onRetry={onRetry} className="py-4" />
      ) : null}

      {detail.status === 'empty' ? <p className="text-small text-fg-muted">{DETAIL_EMPTY}</p> : null}

      {detail.status === 'ready' ? (
        <>
          <dl className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1">
            {detail.facts.map((fact) => (
              <WorkflowFact key={fact.key} fact={fact} />
            ))}
          </dl>
          <dl className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1">
            {detail.tokens.map((fact) => (
              <WorkflowFact key={fact.key} fact={fact} />
            ))}
          </dl>

          {detail.tags.length > 0 ? (
            <ul className="flex min-w-0 flex-wrap gap-1.5">
              {detail.tags.map((tag) => (
                <li key={tag} className="flex">
                  <Badge>{tag}</Badge>
                </li>
              ))}
            </ul>
          ) : null}

          {detail.prompt ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <GroupLabel as="span">Prompt</GroupLabel>
              <pre
                tabIndex={0}
                aria-label="Prompt"
                className={cn(
                  'max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-control border border-line bg-surface p-2 font-mono text-mono text-fg-muted',
                  FOCUS_RING,
                )}
              >
                {detail.prompt}
              </pre>
            </div>
          ) : null}

          {detail.result ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <GroupLabel as="span">Result</GroupLabel>
              <p
                tabIndex={0}
                aria-label="Result"
                className={cn('max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-tag text-small text-fg-muted', FOCUS_RING)}
              >
                {detail.result}
              </p>
            </div>
          ) : null}

          {detail.files.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <GroupLabel as="span" note={String(detail.files.length)}>
                Files touched
              </GroupLabel>
              <ul className="flex min-w-0 flex-col gap-0.5">
                {detail.files.map((file) => (
                  <li key={file.path} title={file.path} className="truncate font-mono text-mono text-fg-muted">
                    {file.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {detail.tools.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <GroupLabel as="span">Tools</GroupLabel>
              <ul className="flex min-w-0 flex-col gap-1.5">
                {detail.tools.map((tool) => (
                  <WorkflowToolBar key={tool.name} tool={tool} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
