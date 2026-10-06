# StatGridLayout

**Level:** Template
**Purpose:** Responsive grid that lays stat tiles out in two to six equal columns with 16px between them.

## When to use

- The row of headline numbers at the top of a page or a section, built from `StatTile`.
- Any set of small, equally sized tiles that should step down to fewer columns on narrow screens.

## When NOT to use

- Full-size cards side by side - use `SplitLayout`, which has the 24px card gap and ratios.
- A single tile - render it alone.

## Slots

| Slot | Description |
|---|---|
| `children` | The tiles, in order. Every direct child is one grid cell and gets `min-w-0`, so labels can truncate. Tiles on the same row stretch to the same height. |

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | required | Tiles slot. |
| `columns` | `2 \| 3 \| 4 \| 5 \| 6` | `4` | Number of columns from `lg` (1024px) up. |

This template does not spread native attributes - it only accepts the slot and prop above.

## Responsive behaviour

| `columns` | Below `md` (768px) | `md` to `lg` | `lg` (1024px) and up |
|---|---|---|---|
| `2` | 2 | 2 | 2 |
| `3` | 2 | 3 | 3 |
| `4` | 2 | 2 | 4 |
| `5` | 2 | 3 | 5 |
| `6` | 2 | 3 | 6 |

- Four columns skip the three-column step, so four tiles sit 2 by 2 below `lg` and never 3 and 1.
- The gap is 16px (`gap-4`) across and down at every width.
- Tiles that do not fill the last row keep their column width and leave the rest of the row empty.

## Usage

```tsx
import { StatGridLayout } from '@/components/design-system/templates/StatGridLayout/StatGridLayout';
```

Four headline numbers:

```tsx
<StatGridLayout>
  <StatTile label="Runs" value="69" />
  <StatTile label="Success rate" value="97%" sub="67 completed, 2 failed" tone="success" />
  <StatTile label="Agents" value="412" />
  <StatTile label="Est. cost" value="~$1,332" />
</StatGridLayout>
```

A dense strip of six:

```tsx
<StatGridLayout columns={6}>{secondaryTiles}</StatGridLayout>
```

## a11y

- Renders a plain `<div>` grid with no roles. Reading order is the DOM order at every width.
- It does not group or name the tiles; put a `GroupLabel` above it when the numbers need a heading.

## Notes

- The cells are the children themselves - no wrapper element is added. A fragment is flattened, and a child that renders nothing takes no cell.
- Layout only: no state, no hooks, no data.
