# RetryPanel

**Level:** Organism
**Purpose:** Card that shows how often an edit worked first time: the one-shot rate as a large number, then the retried edits and the tokens and estimated cost the retries wasted.

## When to use

- The Reliability view of the Insights page, beside `RejectionsPanel`.

## When NOT to use

- Failures of other tools - use `ErrorBreakdown`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `RetryPanelView` | required | The card's view model, built by `buildRetries()` in `@/lib/views/insights`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`RetryPanelView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. |
| `state` | `SectionState \| null` | Loading, error or empty; always null under Codex. |
| `ai` | `SectionAi \| null` | The AI explanation affordance; null under Codex, where there is nothing to explain. |
| `rate` | `string` | The one-shot rate, or "n/a" where retries cannot happen. |
| `applies` | `boolean` | False when the rate does not apply: the number is drawn in `fg-subtle`. |
| `rateNote` | `string` | What the rate is out of, or why it does not apply. |
| `facts` | `{ key, label, value, tone }[]` | Retried edits, wasted tokens and, when above zero, the estimated wasted cost. |
| `footnote` | `string \| null` | How the waste is approximated, and the scope under Both. |

## States

- `loading` - a stat skeleton. `error` - the request failed with nothing earlier to show. `empty` - no Edit or Write call ran in the window.
- Not applicable (Codex) - "n/a" with the reason: a Codex patch applies, fails or is declined, and is never retried.
- Ready - the rate, the facts under a hairline, the footnote.

## Usage

```tsx
import { RetryPanel } from '@/components/design-system/organisms/RetryPanel/RetryPanel';
```

```tsx
<RetryPanel view={view.retries} />
```

## a11y

- The card is a region named by its title. The rate is plain text under its label, followed by the sentence that says what it is out of.
- Toned values sit beside a label: "Retried edits", "Est. wasted cost".

## Notes

- The one `text-metric-lg` of the card is the rate.
- The cost is an estimate and is written with a tilde.
