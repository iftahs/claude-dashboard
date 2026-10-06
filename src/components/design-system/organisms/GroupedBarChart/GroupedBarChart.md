# GroupedBarChart

**Level:** Organism
**Purpose:** Bar chart that sets two or more series side by side per bucket, in tokens or estimated cost, with a legend that carries each series' total.

## When to use

- Comparing the same days across two sources: Claude beside Codex, a server count beside a local count.
- `unit="cost"` when the values are estimated cost instead of tokens.
- `note` for one figure that sums up the comparison, shown after the legend ("24% Codex").

## When NOT to use

- One total split into parts (usage by model) - use `UsageBarChart`, which stacks.
- A share of a total at one point in time - use a split bar or `MeterRow`.
- A rate over time - use a line chart.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `rows` | `readonly GroupedBarRow[]` | required | One entry per bucket, oldest first. Keep the array reference stable between renders: the chart is memoised on it. |
| `series` | `readonly GroupedBarSeries[]` | required | The series in drawing order. Each `key` reads its number from `row.values[key]`. |
| `unit` | `'tokens' \| 'cost'` | `'tokens'` | Formats the axis and the hover read-out: compact numbers, or dollars with a tilde in the read-out. |
| `note` | `string \| null` | - | A short line after the legend. |
| `height` | `number` | `240` | Height of the plot in pixels. The legend sits under it. |
| `ariaLabel` | `string` | - | Text alternative of the chart: what it compares and over which range. |
| `className` | `string` | - | Extra classes merged onto the root. |

`GroupedBarRow`:

| Field | Type | Description |
|---|---|---|
| `label` | `string` | Axis label of the bucket. |
| `title` | `string` | Title of the hover read-out. |
| `footer` | `string \| null` | Closing line of the hover read-out, such as a share or a difference. |
| `values` | `Record<string, number>` | The bucket's number per series key. A missing key draws 0. |

`GroupedBarSeries`: `key`, `label`, `color` (a token value such as a `PLATFORM_COLORS` entry) and an optional `value` shown after the name in the legend.

## Variants

- One bar per series in each bucket, at most 12px wide, with rounded tops.
- Bars animate only up to 60 buckets, so a long range does not replay hundreds of bars on every poll.

## Usage

```tsx
import { GroupedBarChart } from '@/components/design-system/organisms/GroupedBarChart/GroupedBarChart';
```

```tsx
<GroupedBarChart
  rows={view.rows}
  series={view.legend}
  unit="cost"
  note="24% Codex"
  ariaLabel="Estimated cost per day, Claude beside Codex, last 30 days"
/>
```

## a11y

- The plot is a `role="img"` named by `ariaLabel`; the legend under it is a named list, so every series is named in words with its total.
- The hover read-out names each series beside its swatch and is pointer-only: give the same numbers another way where they matter, such as an export.

## Private parts

- `GroupedBarChartTooltip` - maps the hovered bucket to a `ChartTooltip`: one row per series, then the bucket's footer line.

## Notes

- Memoised: it re-renders only when a prop changes. The page re-renders about once a second, so `rows` and `series` must keep their identity between polls.
- Styled only through `@/lib/chart-theme`: horizontal gridlines, axis ticks, cursor and bar radius.
- The cost axis starts at `$0`, and a zero in the read-out is `~$0`.
- The last axis label may reach a few pixels past the plot into the card's padding instead of being clipped.
- It has no card of its own: place it inside a `Section`.
