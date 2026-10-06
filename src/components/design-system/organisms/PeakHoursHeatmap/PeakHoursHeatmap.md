# PeakHoursHeatmap

**Level:** Organism
**Purpose:** Card with a seven-day by 24-hour grid of effective tokens, where darker cells are the busiest hours of the week, under a sentence that names the single busiest hour.

## When to use

- The Trends page's Activity view: when in the week the reader uses the tool most.

## When NOT to use

- Usage per calendar day - use `ActivityHeatmap`.
- Usage per hour of the last day or two - use `HourlyUsageChart`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `PeakHoursView` | required | Built by `buildPeakHours()` in `@/lib/views/trends`: title, description, help, state, the 24 hour labels, one row per weekday in the reader's week order, and the busiest hour. |
| `className` | `string` | - | Extra classes merged onto the card. |

## Variants

- Cells take one of five steps, `heat-0` to `heat-4`: `heat-0` for no usage, then four steps on a square-root scale of the busiest cell, so quiet hours stay apart from empty ones.
- Every third hour is labelled above the grid (`12am`, `3am`, ...), in the reader's local time.
- A "Less ... More" key sits under the grid.

## States

- `view.state` loading, error or empty: the `Section` shows the matching state. The empty state says there is no usage in the fixed window.

## Usage

```tsx
import { PeakHoursHeatmap } from '@/components/design-system/organisms/PeakHoursHeatmap/PeakHoursHeatmap';
```

```tsx
<PeakHoursHeatmap view={view.peakHours} />
```

## a11y

- The grid is a named group; every cell is an image whose name says the weekday, the hour and its effective tokens ("Monday 3pm: 1.2M effective tokens"), shown in a tooltip on hover.
- The busiest hour is also written as a sentence, so the headline does not depend on reading colours.

## Notes

- Memoised on `view`: build it in a `useMemo` in the page hook.
- The window is fixed (the last 90 days) and does not follow the page's range picker; the description says so.
- The 24 columns share the card's width and never scroll.
- Every cell is wrapped in the `Tooltip` atom (150ms delay). Measured in the dev build, the two grids together (294 cells) add about 100ms to mounting the Activity view compared with a native `title`; re-measure before adding more cells. The cells are not in the tab order; assistive tech reads each one's `aria-label`.
