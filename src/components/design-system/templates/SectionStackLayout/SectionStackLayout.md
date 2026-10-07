# SectionStackLayout

**Level:** Template
**Purpose:** Vertical stack that groups cards under an optional section title.

## When to use

- One named section of a page: a `GroupLabel` with the cards, grids and split rows that belong to it.
- `spacing="sm"` for a tight list of related rows or small cards under one title.

## When NOT to use

- The whole page - `PageLayout` already stacks its sections 24px apart.
- Content inside a card - a card has its own `CardHeader` and inner spacing.
- Cards side by side - put a `SplitLayout` or a `StatGridLayout` inside the stack.

## Slots

| Slot | Description |
|---|---|
| `title` | Heading of the group, normally a `GroupLabel`. Sits 12px above the content. |
| `children` | The cards of the group. Every direct child is one row of the stack. |

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `ReactNode` | - | Title slot. Nothing is rendered, and no gap is left, when it is omitted. |
| `children` | `ReactNode` | required | Content slot. |
| `spacing` | `'lg' \| 'sm'` | `'lg'` | Gap between the children: 24px (`gap-6`) or 12px (`gap-3`). |

This template does not spread native attributes - it only accepts the slots and prop above.

## Responsive behaviour

- The same at every width: one column, the title 12px above the content, children 24px or 12px apart.
- It takes the full width of its parent and never overflows it (`min-w-0`); children that collapse on narrow screens, such as a `SplitLayout`, do so on their own.

## Usage

```tsx
import { SectionStackLayout } from '@/components/design-system/templates/SectionStackLayout/SectionStackLayout';
```

A titled section with two rows:

```tsx
<SectionStackLayout title={<GroupLabel note="Max 20x">Plan limits</GroupLabel>}>
  {limitsCard}
  <SplitLayout>
    {contributorsCard}
    {extraUsageCard}
  </SplitLayout>
</SectionStackLayout>
```

Tight stack without a title:

```tsx
<SectionStackLayout spacing="sm">{runCards}</SectionStackLayout>
```

## a11y

- Renders a `<section>` with no accessible name, so it adds no landmark. The heading in `title` (a `GroupLabel` renders an `<h2>`) is what places the group in the page outline.
- Reading and focus order follow the DOM: `title`, then `children`.

## Notes

- A fragment passed as a child is flattened, so each of its elements becomes its own row.
- Layout only: no state, no hooks, no data.

## Motion

- While the enclosing `PageLayout` is entering, each child of the stack fades in (180ms) 40ms after the one before it, up to 120ms, continuing the page's own stagger.
- Nothing is animated after that window, and nothing outside a `PageLayout`.
- Under `prefers-reduced-motion` the global rule makes this instant.
