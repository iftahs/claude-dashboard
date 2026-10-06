# MeterRow

**Level:** Molecule
**Purpose:** Labelled meter: a name on the left, its value in monospace on the right, a progress bar underneath and an optional note.

## When to use

- A limit, a cap or a share of a total: "Weekly limit 83%", "Today $41.20 of $60.00", "Workflow subagents 38%".
- Stacked in a column or a grid to compare several meters.

## When NOT to use

- A headline limit with a large percentage - that is a card of its own, built in an organism.
- A number with no upper bound - use `StatTile` or a plain label and value row.
- A trend over time - use a chart.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | required | What is measured. Truncates with an ellipsis; also names the bar for screen readers. |
| `value` | `ReactNode` | required | The reading shown on the right in monospace: `83%`, `$41.20 of $60.00`. Never wraps. |
| `percent` | `number` | required | How full the bar is, 0 to 100. Clamped by `ProgressBar`. |
| `tone` | `'accent' \| 'warning' \| 'danger' \| 'success' \| 'neutral' \| 'codex'` | `'accent'` | Bar colour. The consumer picks it; limit meters come from `limitTone()`. |
| `note` | `ReactNode` | - | A line under the bar in `text-caption`, `fg-subtle`: when it resets, or why the tone changed. |
| `size` | `'md' \| 'sm'` | `'md'` | `md`: `text-body` label over a 6px bar. `sm`: `text-small` label over a 4px bar. |
| `className` | `string` | - | Extra classes merged onto the root. |

## Variants

- `tone`: the `ProgressBar` tones. Limit meters are `accent` below 70%, `warning` from 70%, `danger` from 90%.
- `size`: `md`, `sm`.
- Label `fg`, value `text-mono` in `fg-muted`, 6px between the lines.

## Usage

```tsx
import { MeterRow } from '@/components/design-system/molecules/MeterRow/MeterRow';
```

A limit with its reset time:

```tsx
<MeterRow label="Weekly limit, all models" value="83%" percent={83} tone="warning" note="Resets Monday 01:00" />
```

A compact list of shares:

```tsx
<div className="flex flex-col gap-4">
  {shares.map((share) => (
    <MeterRow key={share.name} size="sm" label={share.name} value={`${share.percent}%`} percent={share.percent} />
  ))}
</div>
```

## a11y

- The bar is a `role="progressbar"` named by `label`, with `aria-valuenow` set from `percent`.
- The reading is also plain text next to the label, so the tone never carries the status alone. When the tone changes for a reason, say it in `note` ("Over 90% of your weekly cap").
- The label carries its full text in `title`, for when it is truncated.

## Notes

- Fills the width of its container; the label takes the free width and the value keeps its own.
- The row has no outer margin: space rows 16px apart with the parent's gap.

## Motion

- The bar grows from zero on mount and glides to a new value; see `ProgressBar`.
- Under `prefers-reduced-motion` the global rule makes this instant.
