# CacheEfficiencyChart

**Level:** Organism
**Purpose:** Card with the share of tokens served from the prompt cache per day as a line over the selected range, one line per platform when two are compared, with the average and peak rates above it.

## When to use

- The Trends page's Efficiency view, for every platform.

## When NOT to use

- Token or cost totals per day - use `DailyTrendChart`.
- One rate at a single point in time - use a `StatTile` or a `KeyValueRow`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `CacheEfficiencyView` | required | Built by `buildCacheEfficiency()` in `@/lib/views/trends`: title, description, help, state, the series, one row per day, the points behind the hover read-out, the stats line and the average. |
| `className` | `string` | - | Extra classes merged onto the card. |

## Variants

- One series: a single line with a dashed reference line at its average ("Average 62%"), and "Average hit rate" and "Peak" above the chart. No legend.
- Two or more series: one line per platform in its platform colour, each platform's average above the chart and a legend under it. A day a platform was idle breaks its line instead of dropping to 0%.

## States

- `view.state` loading, error or empty: the `Section` shows the matching state. The empty state says there is no cache data in the range.

## Usage

```tsx
import { CacheEfficiencyChart } from '@/components/design-system/organisms/CacheEfficiencyChart/CacheEfficiencyChart';
```

```tsx
<CacheEfficiencyChart view={view.cache} />
```

## a11y

- The chart is an image named by the card's title and description; the stats above it are a description list, so the averages are available as text.
- The hover read-out names each series beside its swatch and is pointer-only.

## Private parts

- `CacheEfficiencyTooltip` - maps the hovered day to a `ChartTooltip`: each series' hit rate, then its cache reads and all tokens.

## Notes

- Memoised on `view`: build it in a `useMemo` in the page hook.
- The hit rate is cache reads divided by all tokens, on a fixed 0 to 100% axis that is 44px wide so the "100%" tick is never clipped.
- Styled only through `@/lib/chart-theme`: gridlines, axis ticks, the line cursor, line width, the active dot and the reference line.

## Motion

- The lines draw in once (450ms, ease-out), when the chart first has data, for up to 60 days. Every later update, poll or resize redraws without animation.
- Reduced motion or a hidden tab: no entrance. Recharts animates in JavaScript, so this is checked in code rather than left to the stylesheet.
