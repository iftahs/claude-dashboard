# Card

**Level:** Atom
**Purpose:** Flat surface container with a hairline border and a 10px radius that holds one block of content.

## When to use

- Every block of content on a page: a chart, a table, a list, a stat tile, an empty or error state.
- `padding="none"` for content that runs edge to edge, such as a table; add `overflow-hidden` so the corners clip.
- `padding="sm"` for stat tiles; `md` for everything else.

## When NOT to use

- Inside another card - use a `surface-sunken` well or a `border-line` divider instead.
- Floating layers (popovers, dialogs, tooltips) - those sit on `surface-raised` with `shadow-pop`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `as` | `'section' \| 'div' \| 'article'` | `'section'` | The element to render. |
| `padding` | `'none' \| 'sm' \| 'md'` | `'md'` | 0, 16px or 20px of inner padding. |
| `className` | `string` | - | Extra classes merged onto the root, for layout such as `flex flex-col gap-4`. |

Spreads remaining `HTMLAttributes<HTMLElement>` onto the root element.

## Variants

- `padding`: `none` (0), `sm` (16px), `md` (20px).
- There is one look: `surface` fill, `border-line`, `rounded-card`, no shadow.

## Usage

```tsx
import { Card } from '@/components/design-system/atoms/Card/Card';
```

Default card:

```tsx
<Card aria-labelledby="limits-title">
  <h2 id="limits-title">Limits</h2>
</Card>
```

Edge-to-edge table:

```tsx
<Card padding="none" className="overflow-hidden">
  {table}
</Card>
```

## a11y

- Renders a `<section>` by default; give it `aria-labelledby` or `aria-label` so it is announced as a region, or pass `as="div"` when it is only a visual box.
- The card itself is not interactive and takes no focus.
