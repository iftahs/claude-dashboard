import { Markdown } from '@/components/design-system/atoms/Markdown/Markdown';
import { StatusDot } from '@/components/design-system/atoms/StatusDot/StatusDot';
import { cn } from '@/lib/cn';
import { datasetsNote } from '@/lib/views/ai';
import { aiChatBubbleVariants } from './AiChatMessage.variants';
import type { AiChatBubbleKind, AiChatMessageProps } from './types';

export function AiChatMessage({ message }: AiChatMessageProps) {
  const fromUser = message.role === 'user';
  const kind: AiChatBubbleKind = fromUser ? 'user' : message.error ? 'error' : 'assistant';
  const note = datasetsNote(message.datasets);

  return (
    <div className={cn('flex min-w-0', fromUser ? 'justify-end' : 'justify-start')}>
      <div role={kind === 'error' ? 'alert' : undefined} className={aiChatBubbleVariants({ kind })}>
        {kind !== 'assistant' ? (
          <p className="break-words">{message.content}</p>
        ) : message.content ? (
          <>
            <Markdown text={message.content} className="break-words" />
            {note ? <p className="mt-2 text-caption text-fg-subtle">{note}</p> : null}
          </>
        ) : (
          <span className="inline-flex items-center gap-2 text-fg-muted">
            <StatusDot tone="accent" size="sm" pulse />
            Thinking
          </span>
        )}
      </div>
    </div>
  );
}
