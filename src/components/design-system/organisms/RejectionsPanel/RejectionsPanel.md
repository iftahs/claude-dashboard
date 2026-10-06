# RejectionsPanel

**Level:** Organism
**Purpose:** Card that lists the tool calls that never ran, by tool: permission prompts you declined and actions the Codex guardian denied, with who said no counted apart.

## When to use

- The Reliability view of the Insights page, beside `RetryPanel`.

## When NOT to use

- Calls that ran and failed - use `ErrorBreakdown`. The failure rate never counts a rejection.
- The overall rejection rate - that is a tile in `InsightKpis`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `RejectionsPanelView` | required | The card's view model, built by `buildRejections()` in `@/lib/views/insights`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`RejectionsPanelView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header, worded for the platform on screen. |
| `state` | `SectionState \| null` | Loading, error or empty; null when there are rejections to show. |
| `ai` | `SectionAi \| null` | The AI explanation affordance. |
| `split` | `{ key, label, value }[]` | Declines by a person and guardian denials. Empty under Claude when the guardian denied nothing. |
| `rows` | `InsightRankedRow[]` | Rejections per tool, then the tool's total calls. A guardian denial names no tool and reads "Guardian deny". |

## States

- `loading` - meter skeletons. `error` - the request failed with nothing earlier to show. `empty` - nothing was declined or denied in the window.
- Ready - the two counts above a hairline when there is a second decider, then the list.

## Usage

```tsx
import { RejectionsPanel } from '@/components/design-system/organisms/RejectionsPanel/RejectionsPanel';
```

```tsx
<SplitLayout>
  <RejectionsPanel view={view.rejections} />
  <RetryPanel view={view.retries} />
</SplitLayout>
```

## a11y

- The card is a region named by its title; the list is named "Rejections by tool" and every bar is a `role="progressbar"` with its count as text.
- Counts are in the warning colour and always sit beside a label that says what they count.

## Notes

- The wording follows the platform: Claude has permission prompts, Codex has guardian denials and declines.
