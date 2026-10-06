# ComplexityScatter

**Level:** Organism
**Purpose:** Card with one dot per session, placed by tool calls and effective tokens and sized by the subagents it spawned or the guardian reviews it got, so the heaviest sessions stand out.

## When to use

- The Pace view of the Insights page, full width.

## When NOT to use

- A list of sessions to open - that is the Sessions page.
- Totals over time - use a bar chart.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `ComplexityScatterView` | required | The card's view model, built by `buildComplexity()` in `@/lib/views/insights`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`ComplexityScatterView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. The description names both axes and what the dot size counts. |
| `state` | `SectionState \| null` | Loading, error or empty; null when there are sessions to plot. |
| `ai` | `SectionAi \| null` | The AI explanation affordance. |
| `series` | `{ key, label, color, points }[]` | One series under a single platform, in that platform's colour; one per platform under Both. |
| `sizeLabel` | `string` | What the dot size counts: "Subagents", "Guardian reviews" or both. |
| `maxSize` | `number` | The largest size value, which scales the dots. |
| `split` | `boolean` | True under Both: the legend is shown and the tooltip names the platform. |

Each point carries `toolCalls`, `effectiveTokens`, `subagents` and its tooltip `rows`.

## States

- `loading` - a chart skeleton. `error` - the request failed with nothing earlier to show. `empty` - no session in the window.
- Ready - the legend under Both, then the chart, 300px tall.

## Usage

```tsx
import { ComplexityScatter } from '@/components/design-system/organisms/ComplexityScatter/ComplexityScatter';
```

```tsx
<ComplexityScatter view={view.complexity} />
```

## a11y

- The card is a region named by its title. The chart is one `role="img"` named by the title and description.
- Under Both the two platforms have a legend and the tooltip names the platform, so colour never identifies a series alone.
- The tooltip is pointer only: a dot's exact numbers are not reachable by keyboard.

## Notes

- Colours are the platform colours from `PLATFORM_COLORS`; horizontal gridlines only.
- Dot area grows with the size value up to a cap, so one session with a hundred reviews cannot swallow the chart.
- Memoised, so an unrelated page update does not redraw the chart.
