# HourlyUsageChart

**Level:** Organism
**Purpose:** Card with the effective tokens used in each recent hour, stacked by model, with its own loading, error and empty states.

## When to use

- The Live usage page, beside the current window gauge (or under the two gauges when both platforms are shown).
- Any place that needs the recent hours as one card.

## When NOT to use

- Days instead of hours, a cost metric or a projection - use `UsageBarChart` inside a `Section`.
- A tiny trend inside another card - use `Sparkline`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `HourlyUsageView` | required | The card's view model, built by `buildHourly()` in `@/lib/views/live`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`HourlyUsageView` fields:

| Field | Type | Description |
|---|---|---|
| `title` | `string` | The card title: "Effective tokens per hour". |
| `description` | `string` | The range and grouping: "Last 24 hours, by model". |
| `help` | `string` | What counts as an effective token and where to change the range. |
| `state` | `SectionState \| null` | Loading, error or empty; null when there is data to plot. |
| `buckets` | `Bucket[]` | One bucket per hour, oldest first. |

## States

- `loading` - a chart skeleton under the real header.
- `error` - the request failed and there is no earlier data to show.
- `empty` - the range has no usage; the text says what fills it.
- Ready - the stacked bars with a legend of the models underneath.

## Usage

```tsx
import { HourlyUsageChart } from '@/components/design-system/organisms/HourlyUsageChart/HourlyUsageChart';
```

Beside a gauge:

```tsx
<SplitLayout ratio="1:2">
  <LimitGauge view={gauge} />
  <HourlyUsageChart view={hourly} />
</SplitLayout>
```

## a11y

- The card is a region named by its title. The plot carries the title and the range as its text alternative.

## Notes

- Memoised on `view`: build the view with `useMemo` in the page hook so the chart is not redrawn on every tick.
- The card grows to its row's height and keeps the chart at the bottom, so it lines up with a taller neighbour.
- The range picker lives in the page header, not in this card.
