import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Dialog } from '@/components/design-system/molecules/Dialog/Dialog';
import { SessionDetailBody } from './SessionDetailBody/SessionDetailBody';
import type { SessionDetailProps } from './types';
import { CLOSE_LABEL, FALLBACK_TITLE } from './utils';

export function SessionDetail({ view, transcript, onClose, onToggleTranscript, onRetryTranscript }: SessionDetailProps) {
  return (
    <Dialog
      open={view !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      title={view?.title ?? FALLBACK_TITLE}
      closeLabel={CLOSE_LABEL}
      description={
        view ? (
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {view.project ? (
              <span dir="auto" title={view.project} className="min-w-0 max-w-full truncate">
                {view.project}
              </span>
            ) : null}
            {view.badge ? <Badge tone="info">{view.badge}</Badge> : null}
            <span className="whitespace-nowrap font-mono text-mono text-fg-subtle">{view.started}</span>
            <span className="whitespace-nowrap font-mono text-mono text-fg-subtle">{view.tokens}</span>
          </span>
        ) : undefined
      }
    >
      {view ? (
        <SessionDetailBody
          view={view}
          transcript={transcript}
          onToggleTranscript={onToggleTranscript}
          onRetryTranscript={onRetryTranscript}
        />
      ) : null}
    </Dialog>
  );
}
