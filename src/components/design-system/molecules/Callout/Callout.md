# Callout

**Level:** Molecule
**Purpose:** Inline notice inside a page or a card: an icon, an optional title and a sentence on a soft status fill, with an optional action.

## When to use

- Something the reader should know before reading what follows: the numbers are partial, a platform is not covered, a setting changes what the page shows.
- `warning` or `danger` when the content below is affected; `info` and `neutral` for context.
- `action` for the one thing the reader can do about it, usually a small `Button`.

## When NOT to use

- A transient message after an action - use `Toast`.
- A card that failed to load or has nothing to show - use `ErrorState` or `EmptyState` (or the `state` of a `Section`).
- A short status next to a title - use `Badge`.
- Model output - use `AiInsightInline`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `tone` | `'info' \| 'success' \| 'warning' \| 'danger' \| 'neutral'` | `'info'` | Colour pair and default icon. |
| `title` | `string` | - | One short line in medium weight above the body. |
| `children` | `ReactNode` | - | The body: one or two sentences. |
| `icon` | `IconName` | per tone | The 16px glyph. Defaults: `info` for info and neutral, `check` for success, `alert` for warning and danger. |
| `action` | `ReactNode` | - | Right slot, vertically centred. Never shrinks. |
| `className` | `string` | - | Extra classes merged onto the root. |

Spreads remaining `HTMLAttributes<HTMLDivElement>` (except `title`) onto the root, for example `role="status"`.

## Variants

- `info`, `success`, `warning`, `danger` - the tone's `-soft` fill with its `-fg` text and icon.
- `neutral` - `surface-hover` fill with `fg-muted` text.
- `text-small`, `rounded-control`, 12px side padding and 10px above and below, no border.

## Usage

```tsx
import { Callout } from '@/components/design-system/molecules/Callout/Callout';
```

A note above a page's content:

```tsx
<Callout tone="neutral">Claude Code only. Codex records no workflow runs, so this page shows the Claude side.</Callout>
```

A warning with a title and an action (the button is composed by the organism):

```tsx
<Callout tone="warning" title="History starts on Sep 12" action={retentionButton}>
  Older transcripts were already deleted, so totals before that day are missing.
</Callout>
```

## a11y

- `role="note"` by default. Pass `role="status"` when it appears after the page loaded and should be announced politely, or `role="alert"` for something urgent.
- The icon is decorative; the words carry the meaning, so the tone never rests on colour alone.
- An `action` is a normal control with its own name and focus ring.

## Notes

- It has no card of its own and no outer margin: place it in a page region or inside a card and space it there.
- Copy rules: sentence case, no exclamation marks, no emoji, say what it means for the reader.
