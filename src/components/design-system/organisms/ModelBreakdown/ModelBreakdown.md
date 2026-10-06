# ModelBreakdown

**Level:** Organism
**Purpose:** Card with a donut of effective tokens by model in each model's fixed colour, a list of every model's tokens and share, and the estimated cost per million effective tokens.

## When to use

- The Mix section of the Models page, beside `EffortBreakdown`.

## When NOT to use

- Usage by model over time - use `UsageBarChart`.
- List prices - use `CostCalculation`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `ModelBreakdownView` | required | The card's view model, built by `buildModelBreakdown()` in `@/lib/views/models`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`ModelBreakdownView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. |
| `state` | `SectionState \| null` | Loading, error or empty; null when there is usage to show. |
| `ai` | `SectionAi \| null` | The AI explanation affordance. |
| `slices` | `{ id, label, color, value, tokens, total, share }[]` | One per model with effective tokens, largest first. `total` includes cache reads and is shown only in the tooltip. |
| `efficiency` | `{ key, label, title, color, percent, value }[]` | Estimated cost per 1M effective tokens for each priced model, cheapest first. |

## States

- `loading` - meter skeletons. `error` - the request failed with nothing earlier to show. `empty` - no model used tokens in the window.
- Ready - the donut beside its list while the card leaves the list 192px, with the list wrapping under the donut in a narrower card; then the cost list under a hairline when any model is priced.

## Usage

```tsx
import { ModelBreakdown } from '@/components/design-system/organisms/ModelBreakdown/ModelBreakdown';
```

```tsx
<SplitLayout>
  <ModelBreakdown view={view.breakdown} />
  <EffortBreakdown view={view.effort} />
</SplitLayout>
```

## a11y

- The card is a region named by its title. The donut is one `role="img"` whose name lists every model's share.
- The list beside it is the legend: each model is named in text with its tokens and share, so colour never identifies a model alone.
- The cost list is named, and every bar is a `role="progressbar"` with the cost as text.

## Notes

- The donut plots effective tokens. Totals including cache reads would be dominated by cache reads, so they appear only in the tooltip.
- Colours come from `modelColor()`: a model keeps its colour on every chart.
- The cost is an estimated equivalent API cost, written with a tilde. A model with no price, such as the Codex guardian review model, is left out of the cost list.
- Memoised, because the models poll refreshes every few seconds.
