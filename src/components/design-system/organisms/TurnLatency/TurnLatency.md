# TurnLatency

**Level:** Organism
**Purpose:** Card that shows how long turns take: the median and 90th-percentile turn and time to first token, with a histogram of turns by duration.

## When to use

- The Pace view of the Insights page, full width.

## When NOT to use

- How long one session or one agent ran - that is on the Sessions and Agents pages.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `TurnLatencyView` | required | The card's view model, built by `buildTurnLatency()` in `@/lib/views/insights`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`TurnLatencyView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. |
| `state` | `SectionState \| null` | Loading, error or empty; null when there are turns to show. |
| `ai` | `SectionAi \| null` | The AI explanation affordance. |
| `facts` | `{ key, label, value, tone, help }[]` | Median turn, p90 turn, median first token, p90 first token. Empty under Both. |
| `platforms` | `{ key, label, color, turns, median, p90, firstToken }[]` | One row per platform. Filled only under Both. |
| `totals` | `string` | The number of turns and the total active time. |
| `histogram` | `{ label, claude, codex, total }[]` | One bucket per duration range. |
| `series` | `{ key, label, color }[]` | One series under a single platform; Claude and Codex, stacked, under Both. |

## States

- `loading` - a chart skeleton. `error` - the request failed with nothing earlier to show. `empty` - no turn finished in the window.
- One platform - the four facts beside the histogram from 1024px, stacked below that.
- Both - a table with a row per platform, then the stacked histogram with its legend.

## Usage

```tsx
import { TurnLatency } from '@/components/design-system/organisms/TurnLatency/TurnLatency';
```

```tsx
<TurnLatency view={view.turns} />
```

## a11y

- The card is a region named by its title. Each fact has a help button named "About" plus its label.
- The per-platform table has a hidden caption and column headers; each platform is named in text beside its swatch.
- The chart is one `role="img"`. With two series it has a legend, and the tooltip names each series.

## Notes

- Bars take the platform colours from `PLATFORM_COLORS`; horizontal gridlines only.
- A dash stands for a figure the platform does not record.
- Memoised, so an unrelated page update does not redraw the chart.
