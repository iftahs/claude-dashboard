# ErrorBreakdown

**Level:** Organism
**Purpose:** Card that breaks down the tool calls that ran and failed: by failure category, by tool with each tool's own failure rate, and as a line of failures per day.

## When to use

- The Reliability view of the Insights page, full width.

## When NOT to use

- Calls that were declined or denied before they ran - use `RejectionsPanel`. A rejection is never a failure.
- The overall failure rate - that is a tile in `InsightKpis`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `ErrorBreakdownView` | required | The card's view model, built by `buildErrorBreakdown()` in `@/lib/views/insights`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`ErrorBreakdownView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. |
| `state` | `SectionState \| null` | Loading, error or empty; null when there are failures to show. |
| `ai` | `SectionAi \| null` | The AI explanation affordance. |
| `categories` | `InsightRankedRow[]` | Failures per category, most first. |
| `tools` | `InsightRankedRow[]` | Tools that failed: failed out of calls, then the tool's failure rate. |
| `toolsNote` | `string \| null` | "Top 8 of 23" when the tool list is clipped. |
| `trend` | `{ date, label, calls, errors }[]` | One point per day. |
| `footnote` | `string` | Reminder that rejections are counted elsewhere. |

## States

- `loading` - meter skeletons under the real header.
- `error` - the request failed and there is nothing earlier to show.
- `empty` - no call failed in the window.
- Ready - the two lists side by side from 1024px, the trend line under a hairline, then the footnote. The trend is left out when it has no points.

## Usage

```tsx
import { ErrorBreakdown } from '@/components/design-system/organisms/ErrorBreakdown/ErrorBreakdown';
```

```tsx
<ErrorBreakdown view={view.errors} />
```

## a11y

- The card is a region named by its title. Both lists are named, and every bar is a `role="progressbar"` with its numbers as text.
- The chart is one `role="img"` named "Failed tool calls per day"; the lists above carry the same failures by category and tool.
- A tool's rate turns warning above 5% and danger above 10%; the percentage itself is always shown.

## Notes

- The chart has one series, so it has no legend; the tooltip names it and adds the day's total calls.
- Memoised, so an unrelated page update does not redraw the chart.
