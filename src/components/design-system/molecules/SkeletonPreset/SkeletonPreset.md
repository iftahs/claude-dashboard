# SkeletonPreset

**Level:** Molecule
**Purpose:** Ready-made loading placeholder in the shape of common content: text, a stat, a chart, meter rows, a table or a limit gauge.

## When to use

- While a card's first request is in flight: render the preset that matches what the card will hold.
- `rows` to match the amount of content that is coming, so the layout does not jump when it arrives.

## When NOT to use

- A shape none of the presets match - stack `Skeleton` blocks yourself in the composing component.
- A refresh of data that is already on screen - keep the content visible.
- Empty or failed states - use `EmptyState` or `ErrorState`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'text' \| 'stat' \| 'chart' \| 'bars' \| 'table' \| 'gauge'` | required | Which shape to draw. |
| `rows` | `number` | per variant | How many repeated shapes: text lines (3), chart bars (12), meter rows (4), table body rows (5), gauge rows (1). Ignored by `stat`. Clamped to 1-40. |
| `className` | `string` | - | Extra classes merged onto the root, for example a height for `chart`. |

## Variants

- `text` - a 14px title line at 40% width, then `rows` 8px lines; the last line is 72% wide.
- `stat` - a label, a value and a sub line, the same height as the content of a `StatTile`.
- `chart` - `rows` vertical bars of uneven height along the bottom of a 180px area. Override the height with `className` (`h-11` gives a sparkline-sized strip).
- `bars` - `rows` meter rows: a label and a value stub over a 6px rounded bar, 16px apart, like a list of `MeterRow`.
- `table` - a 36px `surface-sunken` header and `rows` 40px rows with hairlines: one wide cell and three narrow ones. Put it in a `Card` with `padding="none"`.
- `gauge` - `rows` limit rows: a label and a large number, an 8px rounded bar and a caption line.

## Usage

```tsx
import { SkeletonPreset } from '@/components/design-system/molecules/SkeletonPreset/SkeletonPreset';
```

A chart card that is loading (the header stays real):

```tsx
<Card>
  <CardHeader title="Effective tokens per hour" description="Last 24 hours, by model" />
  {loading ? <SkeletonPreset variant="chart" className="h-[188px]" /> : chart}
</Card>
```

A stat tile and a table:

```tsx
<Card as="div" padding="sm">
  <SkeletonPreset variant="stat" />
</Card>
<Card padding="none" className="overflow-hidden">
  <SkeletonPreset variant="table" rows={8} />
</Card>
```

## a11y

- The root is a `role="status"` region holding the visually hidden word "Loading"; every block is `aria-hidden`, so assistive tech gets one short message instead of a pile of empty boxes.
- The word "Loading" is never shown on screen: sighted readers get the shape of the content.
- The pulse is removed under `prefers-reduced-motion`.

## Notes

- It has no card of its own and no padding: place it where the content will be.
- Blocks use `surface-hover`, the same fill as meter tracks.
- Widths cycle through a fixed pattern, so the placeholder is identical on every render.
