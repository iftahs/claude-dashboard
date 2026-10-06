# CostCalculation

**Level:** Organism
**Purpose:** Card that explains the estimated cost figures: the list prices per million tokens for each model, a note on prompt caching, and a calculator that prices a hypothetical request for the selected model.

## When to use

- The Pricing section of the Models page, full width.

## When NOT to use

- What you actually spent - that is on the Trends and Live usage pages.
- Setting spending caps - that is in Settings.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `CostCalculationView` | required | The card's view model, built by `buildCostCalculation()` in `@/lib/views/models`. |
| `onSelectModel` | `(name: string) => void` | required | Called with a model's name when its row is picked or it is chosen in the model select. |
| `onToggleGroup` | `(group: 'claude' \| 'openai') => void` | required | Called when a vendor's "other models" are shown or hidden. |
| `onTokensChange` | `(field: 'input' \| 'output' \| 'cacheWrite' \| 'cacheRead', value: string) => void` | required | Called with the raw text of a token field as it is typed. |
| `onReset` | `() => void` | required | Called by the Reset button. |
| `className` | `string` | - | Extra classes merged onto the card. |

`CostCalculationView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. The description says how the vendor on screen bills. |
| `groups` | `{ key, label, caption, rows, toggleLabel, expanded }[]` | One rate card per vendor in scope. `label` is set only when two vendors are shown. Each row is a model with its four rates and a `selected` flag. |
| `cachingTitle`, `cachingNote` | `string` | The prompt-caching note under the tables. |
| `modelOptions` | `{ value, label }[]` | Every model in scope, for the model select. |
| `selected` | `string` | The selected model's name. |
| `fields` | `{ key, label, value, helper }[]` | The four token inputs. `helper` repeats the count with separators and says when a rate is not charged. |
| `cost` | `string` | The estimated cost of the request, with a tilde. |
| `formula`, `formulaTotal` | `string[]`, `string` | The arithmetic behind the cost, two lines and the total. |
| `modelNote` | `string \| null` | The selected model's caveat, such as "not billed". |

## States

- The card has no loading, error or empty state: the prices are part of the app.
- Selected model - its table row takes the selected fill and the calculator names it.
- "Other models" collapsed (default) or expanded, per vendor.

## Usage

```tsx
import { CostCalculation } from '@/components/design-system/organisms/CostCalculation/CostCalculation';
```

```tsx
<CostCalculation
  view={view.pricing}
  onSelectModel={view.onSelectModel}
  onToggleGroup={view.onTogglePriceGroup}
  onTokensChange={view.onTokensChange}
  onReset={view.onResetCalculator}
/>
```

## a11y

- The card is a region named by its title. Each table has a hidden caption naming the vendor.
- A model row is focusable and is selected with Enter or Space; the selected row carries `aria-current`. The model select offers the same choice as a labelled control.
- Every input has a visible label and a helper line; the result is an `<output>` announced politely when it changes.
- The toggle is a button with `aria-expanded`.

## Private parts

- `PriceTable` - one vendor's rate card: its label, the table and the toggle for its other models.

## Notes

- Controlled: the page hook owns the selected model, the expanded groups and the token inputs.
- Memoised, because the Models page re-renders with every shared poll; pass stable handlers.
- These are pay-as-you-go API list prices. A subscription has no per-token bill, so every figure here is an estimated equivalent cost.
- A model with no published cache-write rate shows a dash, and its cache write field says it is not charged.
- The tables sit in bordered wells and scroll inside them when the card is narrow.
