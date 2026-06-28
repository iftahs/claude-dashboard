import { useState } from 'react';
import { tagColor } from '@/lib/palette';
import type { TagEditorProps } from './types';

/**
 * Inline chip editor for a project's custom tags. Stateless w.r.t. persistence —
 * the parent owns the tag list (via useTags) and passes value/onChange, so the
 * ProjectBreakdown rows and the TagBreakdown rollup stay in sync.
 */
export function TagEditor({ value, onChange, suggestions = [], placeholder = '+ tag' }: TagEditorProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const t = raw.trim();
    if (t) onChange([...value, t]);
    setDraft('');
    setAdding(false);
  };
  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div className="flex flex-wrap items-center gap-1">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: `${tagColor(tag)}22`, color: tagColor(tag) }}
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            className="leading-none opacity-60 transition-opacity hover:opacity-100"
            aria-label={`Remove tag ${tag}`}
          >
            ×
          </button>
        </span>
      ))}

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add(draft);
            else if (e.key === 'Escape') {
              setDraft('');
              setAdding(false);
            }
          }}
          onBlur={() => add(draft)}
          maxLength={32}
          placeholder="tag name"
          className="w-24 rounded-full border border-white/10 bg-ink-700 px-2 py-0.5 text-[11px] text-zinc-200 outline-none focus:border-clay-500"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-white/15 px-2 py-0.5 text-[11px] text-zinc-500 transition-colors hover:border-clay-500 hover:text-clay-400"
        >
          {placeholder}
        </button>
      )}

      {adding &&
        unused.map((s) => (
          <button
            key={s}
            type="button"
            // mousedown fires before the input's blur, so the quick-add isn't lost
            onMouseDown={(e) => {
              e.preventDefault();
              add(s);
            }}
            className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            {s}
          </button>
        ))}
    </div>
  );
}
