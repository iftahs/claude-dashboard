# PlatformDailyCompareChart

**Level:** Organism
**Purpose:** Card that sets Claude beside Codex day by day over the selected range, in effective tokens or estimated cost, with each platform's total and Codex's share.

## When to use

- The Trends page under the Both platform, where the two platforms are compared.

## When NOT to use

- A single platform - use `DailyTrendChart`, which stacks the days by model.
- Any other pair of series - use `GroupedBarChart` in a `Section`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `PlatformCompareView` | required | Built by `buildPlatformCompare()` in `@/lib/views/trends`: title, description, help, state, the rows, the legend with totals and the share line. |
| `onMetricChange` | `(metric: 'tokens' \| 'cost') => void` | required | Called by the tokens and cost switch in the header. |
| `className` | `string` | - | Extra classes merged onto the card. |

## States

- Ready: the grouped chart, the legend with each platform's total and "N% Codex".
- `view.state` loading, error or empty: the `Section` shows the matching state and the switch stays in the header.

## Usage

```tsx
import { PlatformDailyCompareChart } from '@/components/design-system/organisms/PlatformDailyCompareChart/PlatformDailyCompareChart';
```

```tsx
<PlatformDailyCompareChart view={view.platformCompare} onMetricChange={view.onMetricChange} />
```

## a11y

- The switch is a named group of pressed buttons; the chart is an image named by the card's title and description, and the legend names both platforms with their totals.

## Notes

- Memoised on `view`: build it in a `useMemo` in the page hook.
- Cost compares each vendor's list-price equivalent, never a bill; the help text says so.
- The tokens and cost switch shares its value with `DailyTrendChart`, so the page reads in one unit.
