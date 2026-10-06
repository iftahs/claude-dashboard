# SplitLayout

**Level:** Template
**Purpose:** Places content side by side in two or three columns that collapse to a single column on narrow screens.

## When to use

- Two or three cards that belong on one row: a summary beside its chart, two lists, three breakdowns.
- `ratio` when one of two columns needs more room, such as a narrow summary beside a wide chart (`1:2`).

## When NOT to use

- A row of stat tiles - use `StatGridLayout`.
- Stacking cards vertically - use `SectionStackLayout`.
- Columns inside a card (a list beside its detail, a two-column set of meters) - that grid belongs to the organism.

## Slots

| Slot | Description |
|---|---|
| `children` | The cells, in order. Every direct child is one grid cell and gets `min-w-0`, so charts, tables and truncated text shrink with their column. Cells on the same row stretch to the same height. |

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | required | Cells slot. |
| `columns` | `2 \| 3` | `2` | Number of columns above the `collapseBelow` breakpoint. |
| `ratio` | `'equal' \| '1:2' \| '2:1'` | `'equal'` | Width ratio of the two columns. Ignored when `columns` is `3`, which is always equal. |
| `gap` | `'md' \| 'lg'` | `'lg'` | 16px or 24px between cells, both across and down. |
| `collapseBelow` | `'md' \| 'lg' \| 'xl'` | `'lg'` | The breakpoint under which the cells stack in one column: `md` is 768px, `lg` is 1024px, `xl` is 1280px. Use `xl` for a ratio split whose narrow column would drop under about 300px beside the sidebar. |

This template does not spread native attributes - it only accepts the slot and props above.

## Responsive behaviour

- Below `collapseBelow`: one column, cells stacked in DOM order with the same gap.
- From `collapseBelow` up: `columns` columns. Extra children wrap onto further rows with the same column widths.
- Column tracks are `minmax(0, 1fr)`, with `minmax(0, 2fr)` for the wider column of a ratio, so a wide child can never push the grid past its container.

## Usage

```tsx
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
```

Narrow summary beside a wide chart:

```tsx
<SplitLayout ratio="1:2">
  {windowSummaryCard}
  {tokensPerHourCard}
</SplitLayout>
```

Three equal columns that stay side by side down to 768px, with the tighter gap:

```tsx
<SplitLayout columns={3} gap="md" collapseBelow="md">
  {byModelCard}
  {byProjectCard}
  {byToolCard}
</SplitLayout>
```

## a11y

- Renders a plain `<div>` grid with no roles. Reading and focus order are the DOM order at every width, which is also the visual order.
- Each cell keeps its own semantics; give a card that is a region its own `aria-labelledby`.

## Notes

- The cells are the children themselves - no wrapper element is added - so a child may carry its own grid classes.
- A fragment is flattened: each of its elements is a cell. A child that renders nothing takes no cell, so the next child moves into its place.
- Layout only: no state, no hooks, no data.
