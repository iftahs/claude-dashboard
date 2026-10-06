# LimitGauge

**Level:** Organism
**Purpose:** Card for one platform's current rate-limit window: the share used as a large number over a meter, when the window started and resets, and the local facts behind it such as tokens, estimated cost, previous window and pace.

## When to use

- The Live usage page, one per platform on screen: Claude's 5-hour window, Codex's 5-hour or weekly window.
- Pay-as-you-go mode, where the same card shows the estimated cost of the block and fills against the daily cap.

## When NOT to use

- Every window of a plan at once - use `PlanLimitsCard`.
- A compact summary that links to the full page - use `LimitGlance`.
- One meter inside another card - use `MeterRow`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `LimitGaugeView` | required | The card's view model, built by `buildClaudeGauge()` or `buildCodexGauge()` in `@/lib/views/live`. |
| `wideBelowXl` | `boolean` | `false` | Set it when the card sits in a `SplitLayout` with `collapseBelow="xl"`: from 768px to 1279px the card is full width, so the facts move into a second column beside the headline. |
| `className` | `string` | - | Extra classes merged onto the card. |

`LimitGaugeView` fields:

| Field | Type | Description |
|---|---|---|
| `platform` | `'claude' \| 'codex'` | Which platform the card is for; use it as the React key. |
| `title` | `string` | "5-hour window" or "Weekly window", led by the platform name when both platforms are shown, or the spend title in pay-as-you-go mode. |
| `description` | `string \| null` | "Started 23:10, resets 04:10", or that the window opens with the next message. |
| `help` | `string` | What the percentage and the rows measure. |
| `state` | `SectionState \| null` | Loading or error; null when the card has a reading. |
| `badge` | `{ label, tone, live } \| null` | Where the reading comes from: Live, Snapshot, Expired, Offline, Connecting, Estimated, API key. `live` adds the pulsing dot. |
| `value` | `string` | The headline: `40%`, `12.4M` when the limit is unknown, `~$18.20` in pay-as-you-go mode. |
| `caption` | `string` | The words after the headline: "used, 2h 31m left". |
| `meter` | `{ label, percent, tone, caption } \| null` | The 8px bar. `tone` is `accent`, `warning`, `danger`, or `neutral` when the limit is unknown. |
| `rowsLabel` | `string` | Scope of the rows: "This session, from local logs". |
| `rows` | `LimitGaugeRowView[]` | Facts as `label` and `value` with a `tone` and optional `help`. |
| `notice` | `{ title, description } \| null` | Why live limits are unavailable, with the provider's message. |
| `source` | `string` | One line saying where the numbers come from. |
| `hint` | `string \| null` | A line about browser notification permission for limit alerts. |

## States

- `loading` - a gauge skeleton under the real header.
- `error` - neither local usage nor live limits could be read.
- Live - the provider's percentage with the "Live" badge and a pulsing dot.
- Snapshot, expired or offline - a warning badge, and a notice with the reason when there is one. The rows keep showing local usage.
- Limit unknown - the tokens used as the headline and an empty neutral bar, never a guessed percentage.
- Pay-as-you-go - the estimated cost as the headline; the bar appears only when a daily cap is set.

## Usage

```tsx
import { LimitGauge } from '@/components/design-system/organisms/LimitGauge/LimitGauge';
```

One platform, beside the hourly chart:

```tsx
<SplitLayout ratio="1:2">
  <LimitGauge view={gauge} />
  <HourlyUsageChart view={hourly} />
</SplitLayout>
```

Both platforms side by side:

```tsx
<SplitLayout>
  {gauges.map((gauge) => (
    <LimitGauge key={gauge.platform} view={gauge} />
  ))}
</SplitLayout>
```

## a11y

- The card is a region named by its title.
- The bar is a `role="progressbar"`; the percentage, the time left and the source are plain text, so the tone never carries the status alone.
- The notice is a `role="note"` with the reason in words.

## Notes

- Presentational: every string, number and tone comes from the view. The countdown is refreshed by a tick in the page hook, not by a timer in the card.
- Tones come from `limitTone()` in `@/lib/limits`: `accent` below 70%, `warning` from 70%, `danger` from 90%.
- The headline is the provider's account-wide percentage; the rows are local usage on this machine, which is why they carry their own label.
