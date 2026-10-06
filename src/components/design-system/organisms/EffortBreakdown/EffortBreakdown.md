# EffortBreakdown

**Level:** Organism
**Purpose:** Card that splits effective tokens by the reasoning-effort level each response ran at: one stacked bar for all models with its legend, then each model's mix with its estimated cost and reasoning share.

## When to use

- The Mix section of the Models page, beside `ModelBreakdown`.

## When NOT to use

- Share of tokens by model - use `ModelBreakdown`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `EffortBreakdownView` | required | The card's view model, built by `buildEffortBreakdown()` in `@/lib/views/models`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`EffortBreakdownView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. |
| `state` | `SectionState \| null` | Loading, error or empty; null when there is usage to show. |
| `reasoning` | `string` | Reasoning share of output over all models: "41%", "41% of 62%" when only part of the output reports it, or "n/a". |
| `slices` | `{ key, label, color, percent, detail }[]` | The all-models mix, one slice per effort level. `detail` is tokens, share and estimated cost. |
| `models` | `{ key, model, label, color, summary, cost, reasoning, slices }[]` | One row per model: its name with its fixed colour, estimated cost, reasoning share and effort mix. |

## States

- `loading` - meter skeletons. `error` - the request failed with nothing earlier to show. `empty` - no usage in the window.
- Ready - the all-models bar and legend, then one row per model under a hairline: the model, its estimated cost and reasoning share on one line and its effort bar on the next.

## Usage

```tsx
import { EffortBreakdown } from '@/components/design-system/organisms/EffortBreakdown/EffortBreakdown';
```

```tsx
<EffortBreakdown view={view.effort} />
```

## a11y

- The card is a region named by its title. Every stacked bar is a `role="img"` whose name lists each level's share in words.
- The models are a named list. Column labels sit above it for sighted readers, and each row repeats them for screen readers ("Est. cost", "Reasoning").
- A model's bar is focusable and opens a tooltip with every level's tokens, share and estimated cost, on hover and on keyboard focus.
- The legend names every effort level beside its swatch, so the shade never identifies a level alone.

## Private parts

- `EffortBar` - the 100% stacked bar of one mix, with a 2px gap between levels.
- `EffortSliceList` - the tooltip body: a title and one line per effort level.

## Notes

- Effort is ordinal, so the levels are steps of one hue: the info colour mixed toward the card for the lowest efforts and toward the text colour for the highest. Every step keeps at least 3:1 against the card in both themes. "Not logged" is neutral.
- A partial reasoning figure says what it covers ("41% of 62%") instead of standing in for the whole.
- The model rows keep the bar on its own line, so the card works down to about 300px without scrolling; a long model name truncates with its full id in `title`.
- It has no AI affordance.
- Memoised, because the Models page re-renders with every shared poll.
