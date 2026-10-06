import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/design-system/atoms/Button/Button';
import { Card } from '@/components/design-system/atoms/Card/Card';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { Input } from '@/components/design-system/atoms/Input/Input';
import { EmptyState } from '@/components/design-system/molecules/EmptyState/EmptyState';
import { cn } from '@/lib/cn';
import { AiChatMessage } from './AiChatMessage/AiChatMessage';
import type { AiChatProps } from './types';
import { COMPOSER_LABEL, LINK_CLASS } from './utils';

export function AiChat({ view, onAsk, onNavigate, className }: AiChatProps) {
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const { setup, messages, loading, starters, followUps, contextHref } = view;

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, loading]);

  if (setup) {
    return (
      <Card aria-label={setup.title} className={className}>
        <EmptyState
          icon="sparkles"
          title={setup.title}
          description={setup.description}
          action={
            <a href={setup.href} onClick={(event) => onNavigate?.(event, setup.href)} className={cn(LINK_CLASS, 'text-small font-medium')}>
              {setup.linkLabel}
            </a>
          }
        />
      </Card>
    );
  }

  const ask = (question: string) => {
    if (!question.trim() || loading) return;
    onAsk(question);
    setDraft('');
  };
  const started = messages.length > 0;
  const chips = followUps.length > 0 ? followUps : starters;

  return (
    <Card aria-label="Conversation" padding="none" className={cn('relative min-h-96 flex-1 overflow-hidden', className)}>
      <div className="absolute inset-0 flex flex-col">
        <div
          ref={logRef}
          role="log"
          aria-label="Messages"
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto p-5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          {started ? (
            <div className="flex flex-col gap-3">
              {messages.map((message) => (
                <AiChatMessage key={message.id} message={message} />
              ))}
            </div>
          ) : (
            <div className="flex min-h-full items-center justify-center">
              <EmptyState
                icon="sparkles"
                title="Start with a question"
                description="Pick one of these or type your own."
                className="py-6"
                action={
                  <div className="flex min-w-0 flex-wrap justify-center gap-2">
                    {starters.map((question) => (
                      <Button key={question} size="sm" onClick={() => ask(question)}>
                        {question}
                      </Button>
                    ))}
                  </div>
                }
              />
            </div>
          )}
        </div>
        <div className="flex flex-none flex-col gap-3 border-t border-line p-4">
          {started ? (
            <div className="flex min-w-0 flex-wrap gap-2">
              {chips.map((question) => (
                <Button key={question} size="sm" title={question} disabled={loading} className="max-w-full" onClick={() => ask(question)}>
                  <span className="min-w-0 truncate">{question}</span>
                </Button>
              ))}
            </div>
          ) : null}
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              ask(draft);
            }}
          >
            <Input
              aria-label={COMPOSER_LABEL}
              placeholder={COMPOSER_LABEL}
              autoComplete="off"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button type="submit" variant="primary" disabled={loading || !draft.trim()}>
              Send
            </Button>
          </form>
          <p className="text-caption text-fg-subtle">
            <a href={contextHref} target="_blank" rel="noreferrer" className={cn(LINK_CLASS, 'inline-flex items-center gap-1')}>
              What the AI can see
              <Icon name="externalLink" size={12} />
            </a>{' '}
            opens the exact JSON the chat sends to the model.
          </p>
        </div>
      </div>
    </Card>
  );
}
