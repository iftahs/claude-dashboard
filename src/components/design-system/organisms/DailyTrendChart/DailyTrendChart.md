# DailyTrendChart

**Level:** Organism
**Purpose:** Card with usage per day over the selected range, stacked by model, in effective tokens or estimated cost, with projected days, a today marker and the change against the previous period.

## When to use

- The daily chart of the Trends page, for every platform.
- Wherever a range of whole days should be read by model, with its own export and AI explanation.

## When NOT to use

- Hours instead of days - use `HourlyUsageChart`.
- Two platforms compared day by day - use `PlatformDailyCompareChart`.
- The bare chart inside another card - use `UsageBarChart`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `DailyTrendView` | required | Built by `buildDailyTrend()` in `@/lib/views/trends`: title, description, help, state, the day buckets, the metric, the per-day averages behind the projection and the change badge. |
| `onMetricChange` | `(metric: 'tokens' \| 'cost') => void` | required | Called by the tokens and cost switch in the header. |
| `onExport` | `(format: 'csv' \| 'json') => void` | required | Called by the card's export menu with the chosen format. |
| `ai` | `SectionAi \| null` | - | The AI explanation affordance, from `sectionAi('trends', payload)`. |
| `className` | `string` | - | Extra classes merged onto the card. |

## States

- Ready: the stacked chart with its legend. When the last bucket is today, up to three projected days follow it behind a dashed "Today" line.
- `view.delta`: a neutral badge after the description, "+12% vs previous period", led by the trending icon when usage went up. It wraps under the description when the card is narrow.
- `view.state` loading, error or empty: the `Section` shows the matching state; the switch and the export menu stay, and the export menu is disabled while there is nothing to export.

## Usage

```tsx
import { DailyTrendChart } from '@/components/design-system/organisms/DailyTrendChart/DailyTrendChart';
```

```tsx
<DailyTrendChart view={view.daily} ai={view.dailyAi} onMetricChange={view.onMetricChange} onExport={view.onDailyExport} />
```

## a11y

- The switch is a named group of pressed buttons, the export menu a named menu button, and the chart an image named by the card's title and description.
- The legend names every model in words; the export gives the same numbers as a table.

## Notes

- Memoised on its props: build `view` and `ai` in `useMemo` in the page hook and pass stable handlers.
- Bars are effective tokens (input, output and cache writes); the total with cache reads appears only in the hover read-out.
- Ranges longer than 60 days label the axis with the year ("Sep 22 '26") and title the hover read-out with the full date.
