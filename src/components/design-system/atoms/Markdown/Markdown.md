# Markdown

**Level:** Atom
**Purpose:** Renders a safe subset of markdown from model output as React elements, never as raw HTML.

## When to use

- AI replies and AI-drafted insight text.
- Any short model-written text that may carry bold, italics, inline code, headings or lists.

## When NOT to use

- Trusted static copy - write the markup directly.
- Full markdown (tables, links, images, fenced code blocks) - this subset ignores them and shows the text as written.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | required | The markdown source. |
| `className` | `string` | - | Extra classes merged onto the wrapper, for example `text-fg` or `text-small`. |

## Usage

```tsx
import { Markdown } from '@/components/design-system/atoms/Markdown/Markdown';
```

An AI reply:

```tsx
<Markdown text={message.content} />
```

Smaller, inside a card footnote:

```tsx
<Markdown text={insight} className="text-small" />
```

## a11y

- Lists render as real `<ul>` / `<ol>` with `<li>` items; emphasis as `<strong>` and `<em>`; code as `<code>`.
- Headings render as styled paragraphs, not `<h*>`, so model output cannot disturb the page outline.

## Notes

- Supported: `**bold**`, `*italic*`, `_italic_`, `` `code` ``, `#` to `###` headings, `-` / `*` bullets and `1.` numbered lists.
- Underscore emphasis is ignored inside a word, so `snake_case` names and file paths stay literal.
- A blank line or any non-list line ends the current list.
- Body text is `text-body` in `fg-muted`; headings, bold and code are `fg`.
- Spacing: 8px above a heading, 4px around a list, 2px between paragraphs. The first block has no top margin and the last no bottom margin, so the text lines up with its container's padding.
- Output is built from React elements only, so HTML in the source is shown as text.
- Parsing lives in `utils.ts` (`parseBlocks`, `parseInline`) and returns plain data.
