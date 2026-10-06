import { useRef } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Dialog } from '@/components/design-system/molecules/Dialog/Dialog';
import { SessionDetailBody } from './SessionDetailBody/SessionDetailBody';
import type { SessionDetailProps } from './types';
import { CLOSE_LABEL, FALLBACK_TITLE } from './utils';

export function SessionDetail({ view, transcript, onClose, onToggleTranscript, onRetryTranscript }: SessionDetailProps) {
  // The dialog stays mounted while it animates out, so it keeps showing the session it was closed on.
  const last = useRef({ view, transcript });
  if (view) last.current = { view, transcript };
  const shown = view ?? last.current.view;
  const shownTranscript = view ? transcript : last.current.transcript;

  return (
    <Dialog
      open={view !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      title={shown?.title ?? FALLBACK_TITLE}
      closeLabel={CLOSE_LABEL}
      description={
        shown ? (
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {shown.project ? (
              <span dir="auto" title={shown.project} className="min-w-0 max-w-full truncate">
                {shown.project}
              </span>
            ) : null}
            {shown.badge ? <Badge tone="info">{shown.badge}</Badge> : null}
            <span className="whitespace-nowrap font-mono text-mono text-fg-subtle">{shown.started}</span>
            <span className="whitespace-nowrap font-mono text-mono text-fg-subtle">{shown.tokens}</span>
          </span>
        ) : undefined
      }
    >
      {shown ? (
        <SessionDetailBody
          view={shown}
          transcript={shownTranscript}
          onToggleTranscript={onToggleTranscript}
          onRetryTranscript={onRetryTranscript}
        />
      ) : null}
    </Dialog>
  );
}
