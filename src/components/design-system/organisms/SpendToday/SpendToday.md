# SpendToday

**Level:** Organism
**Purpose:** Card that shows one of today's totals as a large number with its change against the recent daily average, a seven-day sparkline, and an optional daily cap meter and platform split.

## When to use

- The Overview page, twice side by side: "Est. spend today" and "Effective tokens today".
- Any single daily total that reads best next to its recent trend.

## When NOT to use

- A number with no trend - use `StatTile`.
- A chart the reader must read values from - use a real chart with axes and a tooltip.
- A value against a limit with nothing else - use `MeterRow`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `SpendTodayView` | required | The card's view model, built by `buildToday()` in `@/lib/views/overview`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`SpendTodayView` fields:

| Field | Type | Description |
|---|---|---|
| `label` | `string` | The uppercase label, written in sentence case: "Est. spend today". |
| `status` | `'loading' \| 'error' \| 'empty' \| 'ready'` | Which state the body shows. |
| `value` | `string` | The formatted total: `~$41.20`, `8.4M`. |
| `delta` | `string \| null` | Change against the average, as a badge: `+18%`. Hidden when null. |
| `deltaUp` | `boolean` | Adds the trending icon to a rising delta. |
| `comparison` | `string` | The text after the badge: "vs 7-day average of ~$34.90". |
| `trend` | `number[]` | Sparkline values, oldest first; the last bar is highlighted. |
| `trendLabel` | `string` | Text alternative of the sparkline. |
| `cap` | `SpendCapView \| null` | Daily cap meter: `label`, `value`, `percent`, `tone`, `note`. |
| `legend` | `SpendLegendView[]` | Per-platform amounts under Both: `name`, `color`, `value`. |
| `footnote` | `string` | What the number counts. |
| `message` | `{ title, description } \| null` | The empty or error text. |

## States

- `loading` - a `SkeletonPreset` stat beside a sparkline-sized chart skeleton; the footnote stays real.
- `error` - the label and an `ErrorState`.
- `empty` - the label and an `EmptyState` that says what makes the number appear.
- `ready` - label and `metric-lg` value on the left, the sparkline on the right, the delta badge and the comparison on a full-width line under them, then the cap meter, the legend and the footnote under a divider.

## Usage

```tsx
import { SpendToday } from '@/components/design-system/organisms/SpendToday/SpendToday';
```

Both cards on the Overview page:

```tsx
<SplitLayout>
  {today.map((card) => (
    <SpendToday key={card.key} view={card} />
  ))}
</SplitLayout>
```

A single card:

```tsx
<SpendToday view={spend} />
```

## a11y

- The card is a `<section>` labelled by `view.label`; the label is an `<h3>`.
- The sparkline is exposed as an image named by `trendLabel`.
- The delta is text with its sign, so the direction never rests on the icon or a colour.
- The cap meter is a `role="progressbar"` named "Daily cap", with the amounts as plain text beside it.

## Notes

- The value never wraps; the comparison truncates with an ellipsis and keeps its full text in `title`.
- The sparkline column is 120px wide, 96px below 640px.
- Cost values are estimates and arrive prefixed with a tilde; the footnote says so.
- Presentational: no hooks, no routing, no fetching.
