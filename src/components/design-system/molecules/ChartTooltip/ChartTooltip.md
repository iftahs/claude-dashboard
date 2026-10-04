# ChartTooltip

**Level:** Molecule
**Purpose:** Floating read-out for a chart's hovered point: a title, one row per series with its value, and an optional footer.

## When to use

- The hover read-out of every chart. A small adapter in the chart organism maps Recharts' `payload` to `rows` and passes this component through the chart's `content` prop.
- With `footer` for a total or a caveat that belongs to the hovered point, such as the total including cache reads.

## When NOT to use

- Explaining a control or a term - use `Tooltip` or `InfoTip`.
- A legend that is always visible - lay out `LegendDot` entries in the card.
- Anything interactive: it sits under the pointer and cannot be reached.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `rows` | `readonly { label: string; value: string; color?: string }[]` | required | One line per series, in the chart's stacking or legend order. `value` is already formatted. |
| `title` | `ReactNode` | - | What is hovered: the day, the hour, the bucket name. |
| `footer` | `ReactNode` | - | A closing line under a hairline, in `text-caption` `fg-subtle`. |
| `className` | `string` | - | Extra classes merged onto the box. |

## Variants

- A row with `color` leads with a `LegendDot` swatch; a row without one, such as a total, is plain `fg-muted` text.
- Values are monospace, `fg`, right aligned.
- Box: `surface-raised`, `line` border, `shadow-pop`, `rounded-control`, at least 160px wide.

## Usage

```tsx
import { ChartTooltip } from '@/components/design-system/molecules/ChartTooltip/ChartTooltip';
```

Two series and a total:

```tsx
<ChartTooltip
  title="Thu, Sep 24"
  rows={[
    { label: 'Claude', value: '14.2M', color: 'rgb(var(--platform-claude))' },
    { label: 'Codex', value: '2.1M', color: 'rgb(var(--platform-codex))' },
    { label: 'Total', value: '16.3M' },
  ]}
  footer="Effective tokens. Cache reads are not included."
/>
```

Handed to Recharts by the chart organism:

```tsx
<Tooltip content={({ active, payload, label }) => (active ? <ChartTooltip title={label} rows={toRows(payload)} /> : null)} />
```

## a11y

- Every series is named in words next to its swatch, so colour never identifies a series alone.
- It is a pointer-only read-out and takes no role or focus. The chart must expose the same numbers another way, such as a table view or an export.

## Notes

- Nothing wraps: the box grows with its longest row.
- `color` is applied through an inline style by `LegendDot`, so pass a token value (`rgb(var(--model-opus-1))`), not a raw hex.
- It does not position itself; Recharts places it at the pointer.
