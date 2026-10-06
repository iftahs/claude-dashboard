import { memo } from 'react';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { ModelChip } from '@/components/design-system/molecules/ModelChip/ModelChip';
import { cn } from '@/lib/cn';
import { EMPTY_TEXT } from '../utils';
import type { TranscriptTurnProps } from './types';

export const TranscriptTurn = memo(function TranscriptTurn({ turn }: TranscriptTurnProps) {
  return (
    <li dir="ltr" className="flex min-w-0 flex-col items-start gap-1.5">
      <div className="flex min-w-0 max-w-full items-center gap-2">
        <Icon name={turn.user ? 'user' : 'bot'} size={14} className="flex-none text-fg-subtle" />
        <span className="flex-none text-label uppercase text-fg-subtle">{turn.role}</span>
        {turn.time ? <span className="flex-none whitespace-nowrap font-mono text-mono tabular-nums text-fg-subtle">{turn.time}</span> : null}
        {turn.model ? <ModelChip model={turn.model} /> : null}
        {turn.empty ? <span className="min-w-0 truncate text-caption text-fg-subtle">{EMPTY_TEXT}</span> : null}
      </div>

      {turn.text ? (
        <p
          dir="auto"
          className={cn(
            'max-h-72 max-w-[85%] overflow-y-auto whitespace-pre-wrap break-words rounded-control px-3 py-2 text-body text-fg',
            turn.user ? 'bg-surface-hover' : 'border border-line',
          )}
        >
          {turn.text}
        </p>
      ) : null}

      {turn.tools.length > 0 ? (
        <ul className="flex min-w-0 max-w-full flex-col gap-0.5 rounded-control border border-line bg-surface-sunken px-3 py-2 font-mono text-code">
          {turn.tools.map((tool) => (
            <li key={tool.key} title={tool.title} className="flex min-w-0 gap-2">
              <span className="flex-none whitespace-nowrap text-fg">{tool.label}</span>
              {tool.brief ? <span className="min-w-0 truncate text-fg-muted">{tool.brief}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
});
