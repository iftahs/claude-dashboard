import { memo } from 'react';
import { Callout } from '@/components/design-system/molecules/Callout/Callout';
import { ErrorState } from '@/components/design-system/molecules/ErrorState/ErrorState';
import { SkeletonPreset } from '@/components/design-system/molecules/SkeletonPreset/SkeletonPreset';
import { cn } from '@/lib/cn';
import { TranscriptTurn } from './TranscriptTurn/TranscriptTurn';
import type { TranscriptPaneProps } from './types';
import { ERROR_TITLE, LIST_LABEL, SKELETON_ROWS } from './utils';

export const TranscriptPane = memo(function TranscriptPane({ view, onRetry, id, className }: TranscriptPaneProps) {
  return (
    <div id={id} className={cn('flex min-w-0 flex-col gap-3', className)}>
      {view.status === 'loading' ? <SkeletonPreset variant="text" rows={SKELETON_ROWS} /> : null}

      {view.status === 'error' ? <ErrorState title={ERROR_TITLE} description={view.message} onRetry={onRetry} className="py-6" /> : null}

      {view.status === 'archived' ? <Callout tone="neutral">{view.message}</Callout> : null}

      {view.status === 'empty' ? <p className="text-small text-fg-muted">{view.message}</p> : null}

      {view.status === 'ready' ? (
        <>
          {view.truncated ? <Callout tone="warning">{view.truncated}</Callout> : null}
          <ol aria-label={LIST_LABEL} className="flex min-w-0 flex-col gap-4">
            {view.turns.map((turn) => (
              <TranscriptTurn key={turn.key} turn={turn} />
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
});
