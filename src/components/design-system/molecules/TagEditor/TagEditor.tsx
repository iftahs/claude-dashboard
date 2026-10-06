import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/design-system/atoms/Button/Button';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { Input } from '@/components/design-system/atoms/Input/Input';
import { cn } from '@/lib/cn';
import { tagColor } from '@/lib/palette';
import type { TagEditorMode, TagEditorProps } from './types';
import { ADDING, FOCUS_RING_INSET, IDLE, TAG_MAX_LENGTH, nextTags, unusedSuggestions } from './utils';

export function TagEditor({ value, onChange, label, suggestions = [], addLabel = 'Tag', className }: TagEditorProps) {
  const [mode, setMode] = useState<TagEditorMode>(IDLE);
  const [draft, setDraft] = useState('');
  const skipCommit = useRef(false);
  const refocus = useRef(false);
  const addRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mode.kind !== 'idle' || !refocus.current) return;
    refocus.current = false;
    addRef.current?.focus();
  }, [mode]);

  const open = (next: TagEditorMode, text: string) => {
    skipCommit.current = false;
    setDraft(text);
    setMode(next);
  };
  const close = () => {
    setDraft('');
    setMode(IDLE);
  };
  const commit = () => {
    const next = skipCommit.current ? null : nextTags(value, mode, draft);
    skipCommit.current = false;
    if (next) onChange(next);
    close();
  };
  const remove = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
    addRef.current?.focus();
  };
  const pick = (tag: string) => {
    skipCommit.current = true;
    onChange([...value, tag]);
    close();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return;
    event.preventDefault();
    if (event.key === 'Escape') skipCommit.current = true;
    refocus.current = true;
    event.currentTarget.blur();
  };

  const field = (name: string) => (
    <Input
      size="sm"
      autoFocus
      aria-label={name}
      placeholder="Tag name"
      maxLength={TAG_MAX_LENGTH}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={onKeyDown}
      onBlur={commit}
      className="w-28 font-mono"
    />
  );

  return (
    <div role="group" aria-label={label} className={cn('flex min-h-control-sm min-w-0 flex-wrap items-center gap-1.5', className)}>
      {value.map((tag) =>
        mode.kind === 'rename' && mode.tag === tag ? (
          <span key={tag} className="flex">
            {field(`Rename tag ${tag}`)}
          </span>
        ) : (
          <span
            key={tag}
            className="inline-flex h-[22px] min-w-0 max-w-full items-center rounded-control border border-line font-mono text-mono text-fg-muted"
          >
            <button
              type="button"
              aria-label={`Rename tag ${tag}`}
              title={`Rename tag ${tag}`}
              onClick={() => open({ kind: 'rename', tag }, tag)}
              className={cn('flex h-full min-w-0 items-center gap-1.5 rounded-l-control pl-2 pr-1 transition-colors duration-fast ease-standard hover:text-fg', FOCUS_RING_INSET)}
            >
              <span aria-hidden="true" className="size-1.5 flex-none rounded-full" style={{ backgroundColor: tagColor(tag) }} />
              <span className="min-w-0 truncate">{tag}</span>
            </button>
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => remove(tag)}
              className={cn('flex h-full flex-none items-center rounded-r-control pl-0.5 pr-1.5 text-fg-subtle transition-colors duration-fast ease-standard hover:text-fg', FOCUS_RING_INSET)}
            >
              <Icon name="x" size={12} />
            </button>
          </span>
        ),
      )}

      {mode.kind === 'add' ? (
        field('New tag')
      ) : (
        <Button ref={addRef} variant="ghost" size="sm" onClick={() => open(ADDING, '')} className="px-1.5 text-caption">
          <Icon name="plus" size={12} />
          {addLabel}
        </Button>
      )}

      {mode.kind === 'add'
        ? unusedSuggestions(value, suggestions).map((tag) => (
            <button
              key={tag}
              type="button"
              tabIndex={-1}
              title={`Add tag ${tag}`}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(tag);
              }}
              className="inline-flex h-[22px] flex-none items-center rounded-control border border-dashed border-line-strong px-2 font-mono text-mono text-fg-subtle transition-colors duration-fast ease-standard hover:text-fg"
            >
              {tag}
            </button>
          ))
        : null}
    </div>
  );
}
