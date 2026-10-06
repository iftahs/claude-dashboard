# UsageBarChart

**Level:** Organism
**Purpose:** Stacked bar chart of usage over time, one bar per bucket and one segment per model, in effective tokens or estimated cost, with optional projected bars and a today marker.

## When to use

- Usage per hour or per day, split by model: the hourly chart on Live usage, the daily chart on Trends.
- `metric="cost"` to stack each model's estimated cost instead of its effective tokens.
- `projectionCostPerDay` on a daily chart to append up to three projected days and mark today.

## When NOT to use

- Two platforms compared side by side - that is a grouped chart with `PLATFORM_COLORS`.
- A tiny trend with no axes - use `Sparkline`.
- A share of a total - use `MeterRow`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `buckets` | `readonly Bucket[]` | required | The buckets as the API returns them (`RecentData.buckets`, `WeeklyData.buckets`), oldest first. Keep the array reference stable between renders: the chart is memoised on it. |
| `labelFor` | `(ms: number) => string` | required | Axis label for a bucket start: `hourLabel` or `dayLabel` from `@/lib/format`. Pass a module-level function, not an inline arrow, so the memo holds. |
| `titleFor` | `(ms: number) => string` | `labelFor` | Title of the hover read-out, when it should say more than the axis label (the date beside the hour). |
| `metric` | `'tokens' \| 'cost'` | `'tokens'` | `tokens` stacks effective tokens per model; `cost` stacks estimated cost per model. |
| `projectionCostPerDay` | `number` | - | Daily charts only. When above zero and the last bucket is today, appends up to three projected days (never past the end of the month) and draws the today marker. |
| `projectionTokensPerDay` | `number` | average of `buckets` | Height of a projected bar under `metric="tokens"`. |
| `now` | `number` | `Date.now()` at render | The clock used for the today marker and for flagging future buckets. Pass it only from a value that does not change every second. |
| `height` | `number` | `260` | Height of the plot in pixels. The legend sits under it. |
| `ariaLabel` | `string` | - | Text alternative of the chart: what it plots and over which range. |
| `className` | `string` | - | Extra classes merged onto the root. |

## Variants

- Series: one per model with a value in the range, largest total at the bottom, coloured by `modelColor()`. The `<synthetic>` model and models with no value for the metric are left out.
- Projected: one neutral series named "Projected" on the appended days, with a dashed "Today" line at the current bucket.
- Bars animate only up to 60 buckets, so a long range does not replay hundreds of bars on every poll.

## Usage

```tsx
import { UsageBarChart } from '@/components/design-system/organisms/UsageBarChart/UsageBarChart';
```

Hourly tokens by model:

```tsx
<UsageBarChart buckets={recent.buckets} labelFor={hourLabel} titleFor={dateTimeLabel} ariaLabel="Effective tokens per hour, last 24 hours, by model" />
```

Daily estimated cost with a projection:

```tsx
<UsageBarChart
  buckets={weekly.buckets}
  labelFor={dayLabel}
  metric="cost"
  projectionCostPerDay={costPerDay}
  projectionTokensPerDay={tokensPerDay}
/>
```

## a11y

- The plot is a `role="img"` named by `ariaLabel`; the legend under it is a named list, so every series is also named in words.
- The hover read-out names each model beside its swatch and is pointer-only: give the same numbers another way where they matter, such as an export.

## Private parts

- `UsageBarChartTooltip` - maps the hovered bucket to a `ChartTooltip`: models sorted by value, then all tokens including cache reads and the estimated cost.

## Notes

- Memoised: it re-renders only when a prop changes. The page re-renders about once a second, so `buckets`, `labelFor` and `titleFor` must keep their identity between polls.
- Bars are effective tokens (input, output and cache writes). The total with cache reads appears only in the hover read-out.
- Styled only through `@/lib/chart-theme`: horizontal gridlines, axis ticks, cursor, bar radius, the today line and the projected fill.
- It has no card of its own: place it inside a `Section`.
