import type { InlineToken, MarkdownBlock, PendingList } from './types';

const INLINE_PATTERN = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g;
const WORD_CHAR = /\w/;
const HEADING_PATTERN = /^(#{1,3})\s+(.*)$/;
const BULLET_PATTERN = /^\s*[-*]\s+(.*)$/;
const ORDERED_PATTERN = /^\s*\d+\.\s+(.*)$/;

function isIntraWord(text: string, start: number, length: number) {
  return WORD_CHAR.test(text[start - 1] ?? '') || WORD_CHAR.test(text[start + length] ?? '');
}

export function parseInline(text: string, keyBase: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  let count = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const raw = match[0];
    const start = match.index;
    if (start > last) tokens.push({ kind: 'text', text: text.slice(last, start) });
    const key = `${keyBase}-${count}`;
    count += 1;
    if (raw.startsWith('`')) {
      tokens.push({ kind: 'code', key, text: raw.slice(1, -1) });
    } else if (raw.startsWith('**')) {
      tokens.push({ kind: 'strong', key, text: raw.slice(2, -2) });
    } else if (raw.startsWith('_') && isIntraWord(text, start, raw.length)) {
      tokens.push({ kind: 'text', text: raw });
    } else {
      tokens.push({ kind: 'em', key, text: raw.slice(1, -1) });
    }
    last = start + raw.length;
  }
  if (last < text.length) tokens.push({ kind: 'text', text: text.slice(last) });
  return tokens;
}

export function parseBlocks(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let list: PendingList | null = null;

  const flush = () => {
    if (!list) return;
    const key = `l${blocks.length}`;
    blocks.push({
      kind: 'list',
      key,
      ordered: list.ordered,
      items: list.items.map((item, itemIndex) => parseInline(item, `${key}-${itemIndex}`)),
    });
    list = null;
  };

  text.split('\n').forEach((raw, lineIndex) => {
    const line = raw.trimEnd();
    const heading = line.match(HEADING_PATTERN);
    const bullet = line.match(BULLET_PATTERN);
    const ordered = line.match(ORDERED_PATTERN);

    if (heading) {
      flush();
      blocks.push({
        kind: 'heading',
        key: String(lineIndex),
        level: heading[1].length,
        inline: parseInline(heading[2], `h${lineIndex}`),
      });
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
    if (ordered) {
      if (!list || !list.ordered) {
        flush();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]);
      return;
    }
    flush();
    if (line.trim() === '') return;
    blocks.push({ kind: 'paragraph', key: String(lineIndex), inline: parseInline(line, `p${lineIndex}`) });
  });
  flush();

  return blocks;
}
