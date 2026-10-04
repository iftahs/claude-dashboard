# Badge

**Level:** Atom
**Purpose:** Short status or count label on a soft tinted fill.

## When to use

- A status in words: Completed, Waiting on you, Update available.
- A count or percentage beside a nav item or a title: `3`, `83%`.

## When NOT to use

- Model, project or branch identifiers - use `Chip`.
- A bare colour signal with no text - use `StatusDot` beside a word.
- An action - use `Button`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `tone` | `'neutral' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info'` | `'neutral'` | Colour pair. |
| `children` | `ReactNode` | - | The text, optionally led by a 12px icon. |
| `className` | `string` | - | Extra classes merged onto the badge. |

Spreads remaining `HTMLAttributes<HTMLSpanElement>` onto the `<span>`.

## Variants

- `neutral` - `surface-hover` fill, `fg-muted` text.
- `accent`, `success`, `warning`, `danger`, `info` - the tone's `-soft` fill with its `-fg` text.

## Usage

```tsx
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
```

Status:

```tsx
<Badge tone="success">Completed</Badge>
```

Count:

```tsx
<Badge>12</Badge>
```

## a11y

- The text carries the meaning; the tone only reinforces it. Never use a tone with no words.
- An icon passed as a child must be `aria-hidden`.
- Not interactive and not focusable.

## Notes

- 20px tall, 4px radius, 12px medium text, 4px gap between an icon and the text.
- Never wraps and never shrinks.
