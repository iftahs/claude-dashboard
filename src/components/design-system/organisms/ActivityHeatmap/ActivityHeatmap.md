# ActivityHeatmap

**Level:** Organism
**Purpose:** Card with a calendar of the last 18 weeks, one square per day shaded by its effective tokens and marked with the day of the month and the day's total, under a sentence that names the busiest day.

## When to use

- The Trends page's Activity view: day-to-day usage and streaks at a glance.

## When NOT to use

- When in the week usage peaks - use `PeakHoursHeatmap`.
- Exact daily totals by model - use `DailyTrendChart`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `ActivityHeatmapView` | required | Built by `buildActivityHeatmap()` in `@/lib/views/trends`: title, description, help, state, a label per week column (the month when it changes), one row per weekday with its 18 cells, and the busiest day. |
| `className` | `string` | - | Extra classes merged onto the card. |

## Variants

- Cells take one of five steps, `heat-0` to `heat-4`: `heat-0` for a day with no usage, then four steps on a square-root scale of the busiest day, so light days stay visible.
- Each cell shows the day of the month and, when there was usage, the day's effective tokens in compact form.
- Days after today are outlined with a dashed border and carry no fill.
- Monday, Wednesday and Friday are labelled on the left; a month name sits over the first week of each month.
- A "Less ... More tokens per day" key sits under the grid.

## States

- `view.state` loading, error or empty: the `Section` shows the matching state. The empty state says there is no usage in the last 18 weeks.

## Usage

```tsx
import { ActivityHeatmap } from '@/components/design-system/organisms/ActivityHeatmap/ActivityHeatmap';
```

```tsx
<ActivityHeatmap view={view.activity} />
```

## a11y

- The grid is a named group; every cell is an image whose name gives the full date with its effective tokens, messages and tool calls, shown in a tooltip on hover.
- The busiest day is also written as a sentence, so the headline does not depend on reading colours.
- Text on the cells switches colour with the step and reads at 4.5:1 or better on every fill in both themes. `heat-3` in the dark theme is tuned for that; re-measure the cells if a heat token changes.

## Notes

- Memoised on `view`: build it in a `useMemo` in the page hook.
- Every cell is wrapped in the `Tooltip` atom (150ms delay). Measured in the dev build, the two grids together (294 cells) add about 100ms to mounting the Activity view compared with a native `title`; re-measure before adding more cells. The cells are not in the tab order; assistive tech reads each one's `aria-label`.
- The window is fixed (18 weeks, aligned to the reader's first day of the week) and does not follow the page's range picker; the description says so.
- Below about 900px of card width the grid keeps its size and scrolls sideways inside the card, starting at the newest weeks with the weekday labels pinned to the left edge; the page itself never scrolls.
