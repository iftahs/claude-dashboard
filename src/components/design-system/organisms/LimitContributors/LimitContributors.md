# LimitContributors

**Level:** Organism
**Purpose:** Card that says what is driving limit usage over the last day or week: headline behaviours in a sentence each, then the share taken by skills, subagents, plugins and MCP servers.

## When to use

- The Live usage page, one per platform: under Both, the Claude card and the Codex card sit side by side.

## When NOT to use

- Usage split by model or by project - that belongs to the Models and Trends pages.
- The limit windows themselves - use `PlanLimitsCard`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `LimitContributorsView` | required | The card's view model, built by `buildContributors()` in `@/lib/views/live`. |
| `onRangeChange` | `(key: string, range: 'day' \| 'week') => void` | required | Called with the card's `key` and the picked period. |
| `className` | `string` | - | Extra classes merged onto the card. |

`LimitContributorsView` fields:

| Field | Type | Description |
|---|---|---|
| `key` | `string` | Which card this is: `claude`, `codex`, or `scope` for the platform on screen. Passed back to `onRangeChange`. |
| `title` | `string` | "What is contributing to your limits", with the platform after it when two cards are shown. |
| `description` | `string` | The period, that the figures are approximate and local, and how shares are weighted. |
| `help` | `string` | How the breakdown is computed and what it leaves out. |
| `state` | `SectionState \| null` | Loading, error or empty; null when there is something to show. |
| `range` | `'day' \| 'week'` | The selected period: the last 24 hours or the last 7 days. |
| `behaviors` | `{ key, headline, body }[]` | Headline behaviours for the period. |
| `breakdowns` | `{ key, label, rows }[]` | One group per kind (skills, subagents, plugins, MCP servers), each row a `name` and a `percent`. Empty kinds are left out. |

## States

- `loading` - meter skeletons under the real header.
- `error` - the request failed and there is nothing earlier to show.
- `empty` - nothing stands out in either period.
- Ready - the behaviours, or one line saying nothing is over 10% in this period, then the breakdown groups in two columns.

## Usage

```tsx
import { LimitContributors } from '@/components/design-system/organisms/LimitContributors/LimitContributors';
```

One card beside the limit hits:

```tsx
<SplitLayout>
  <LimitContributors view={contributors} onRangeChange={onContribRange} />
  <LimitHitsCard view={limitHits} />
</SplitLayout>
```

## a11y

- The card is a region named by its title. The period picker is a group named "Period" whose buttons carry `aria-pressed`.
- Every share is a `role="progressbar"` named by its row, with the percentage as text.
- The behaviours are a list; the leading icon is decorative.

## Private parts

- `LimitContributorsBreakdown` - one group: its label and a compact meter per row.

## Notes

- Controlled: the page hook owns the period per card and rebuilds the view when it changes.
- The periods are the last 24 hours and the last 7 days, not the 5-hour and weekly limit windows.
- Shares are independent characteristics of the usage, so they do not add up to 100%.
