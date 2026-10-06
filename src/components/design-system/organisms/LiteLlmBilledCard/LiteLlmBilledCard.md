# LiteLlmBilledCard

**Level:** Organism
**Purpose:** Card with what a LiteLLM gateway actually billed: the month-to-date total with its request facts, the spend of each day in the selected range as a bar chart, and the month's token mix.

## When to use

- The Trends page's Spend view, only when a LiteLLM gateway is configured and Claude is on screen. It is the real bill beside the estimated cost.

## When NOT to use

- Subscription usage - there is no per-token bill, so show the estimate (`SpendKpiTiles`, `DailyTrendChart`).
- Spend against a cap - use `SpendCapsCard`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `LiteLlmBilledView` | required | Built by `buildLiteLlmBilled()` in `@/lib/views/trends`: title, description (the gateway host), help, state, the month panel, the range label and total, one entry per day, the truncation note and the token mix. |
| `className` | `string` | - | Extra classes merged onto the card. |

## Variants

- Month panel (a sunken well, one third of the card from 1024px): the month-to-date amount as the card's one large number, then facts as rows: requests since the 1st, the change against the same point of last month, the share of successful requests in a status tone, failed requests and the lifetime total. A fact with no data is left out.
- Daily chart: one bar per calendar day of the range, today's bar in a lighter tone. Hovering a day shows its spend, the split by model and the successful requests.
- Token mix: one segmented bar and a legend with input, output, cache write and cache read tokens of the month. Left out when the gateway reports no tokens.
- A warning callout under the chart when the gateway returned more rows than the dashboard pages through.

## States

- `view.state` loading or error: the `Section` shows the matching state.

## Usage

```tsx
import { LiteLlmBilledCard } from '@/components/design-system/organisms/LiteLlmBilledCard/LiteLlmBilledCard';
```

```tsx
{view.billed ? <LiteLlmBilledCard view={view.billed} /> : null}
```

## a11y

- The chart and the token mix bar are images with text names; the mix legend names every part with its token count.
- The success rate carries a tone, and its label says what the number is, so the colour is not the only signal.

## Private parts

- `LiteLlmDailyChart` - the bar chart of billed spend per day, with today's bar in a lighter tone.
- `LiteLlmDailyTooltip` - maps the hovered day to a `ChartTooltip`: the day's spend, one row per model and the successful requests.

## Notes

- Memoised on `view`: build it in a `useMemo` in the page hook.
- These amounts are a real bill, so they are written without the tilde that marks an estimate.
- It can exceed the estimate, because the gateway also bills failed and retried requests; the help text says so.
