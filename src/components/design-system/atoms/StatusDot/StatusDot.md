# StatusDot

**Level:** Atom
**Purpose:** Small round dot that shows a status tone, with an optional live pulse and screen-reader label.

## When to use

- Beside a status word: Running, Stalled, Waiting on you, Idle, Live.
- `pulse` only for something happening right now, such as the live indicator or a running agent.

## When NOT to use

- As the only signal of a status - always pair it with a word or pass `label`.
- A legend swatch for a chart series - use `LegendDot`.
- A status with text inside a pill - use `Badge`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `tone` | `'success' \| 'warning' \| 'danger' \| 'info' \| 'accent' \| 'neutral'` | `'success'` | Fill colour. `neutral` is `fg-subtle`. |
| `size` | `'sm' \| 'md'` | `'md'` | 6px or 8px. |
| `pulse` | `boolean` | `false` | Adds the slow live ping: a ring that expands from the dot and fades. |
| `label` | `string` | - | Visually hidden text read by screen readers. |
| `className` | `string` | - | Extra classes merged onto the dot. |

## Variants

- `tone`: `success`, `warning`, `danger`, `info`, `accent`, `neutral`.
- `size`: `sm` (6px), `md` (8px).
- `pulse`: `animate-live-ping`, switched off by `motion-reduce:animate-none`.

## Usage

```tsx
import { StatusDot } from '@/components/design-system/atoms/StatusDot/StatusDot';
```

Beside a visible word (the dot is decoration):

```tsx
<span className="inline-flex items-center gap-1.5 text-small text-fg-muted">
  <StatusDot tone="warning" />
  Stalled
</span>
```

Live indicator, standing alone:

```tsx
<StatusDot tone="success" size="sm" pulse label="Live" />
```

## a11y

- Without `label` the dot is `aria-hidden`; the visible word next to it carries the status.
- With `label` the text is rendered visually hidden inside the dot.
- The pulse is removed under `prefers-reduced-motion`.

## Notes

- The ping is the `live-ping` animation from `tailwind.config.js`: a box-shadow ring, so the dot itself never fades or moves.
- The ring takes the dot's own colour (`currentColor`), so `pulse` works with every `tone`.
