import type { ReactNode } from 'react';
import type { MarkdownProps } from './types';

// Minimal, dependency-free markdown for AI replies. Renders to React elements
// (never dangerouslySetInnerHTML), so model output can't inject HTML. Supports a
// safe subset: **bold**, *italic* / _italic_, `code`, # headings, and - / 1. lists.

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-ink-700 px-1 py-0.5 font-mono text-[0.85em] text-clay-300">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-zinc-100">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith('_')) {
      // Underscore emphasis only when not intra-word, so snake_case identifiers
      // and file_paths in model output aren't mangled into italics.
      const before = text[m.index - 1] ?? '';
      const after = text[m.index + tok.length] ?? '';
      if (/\w/.test(before) || /\w/.test(after)) {
        nodes.push(tok); // part of a word — render literally
      } else {
        nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
      }
    } else {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ text, className = '' }: MarkdownProps) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const items = list.items;
    const key = `l${blocks.length}`;
    blocks.push(
      list.ordered ? (
        <ol key={key} className="my-1 list-decimal space-y-0.5 pl-5">
          {items.map((it, i) => (
            <li key={i}>{renderInline(it, `${key}-${i}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key} className="my-1 list-disc space-y-0.5 pl-5">
          {items.map((it, i) => (
            <li key={i}>{renderInline(it, `${key}-${i}`)}</li>
          ))}
        </ul>
      ),
    );
    list = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const num = line.match(/^\s*\d+\.\s+(.*)$/);

    if (h) {
      flush();
      const cls = h[1].length === 1 ? 'text-base font-bold' : 'text-sm font-semibold';
      blocks.push(
        <p key={idx} className={`mt-2 text-zinc-100 ${cls}`}>
          {renderInline(h[2], `h${idx}`)}
        </p>,
      );
      return;
    }
    if (bullet) {
      if (!list || list.ordered) {
        flush();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
      return;
    }
    if (num) {
      if (!list || !list.ordered) {
        flush();
        list = { ordered: true, items: [] };
      }
      list.items.push(num[1]);
      return;
    }
    flush();
    if (line.trim() === '') return;
    blocks.push(
      <p key={idx} className="my-0.5">
        {renderInline(line, `p${idx}`)}
      </p>,
    );
  });
  flush();

  return <div className={`space-y-0.5 leading-relaxed ${className}`}>{blocks}</div>;
}
