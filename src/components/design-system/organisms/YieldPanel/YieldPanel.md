# YieldPanel

**Level:** Organism
**Purpose:** Card that follows the window's sessions down a funnel, from every session to those in a git repo, those that committed and those that opened a pull request, with the tokens behind each outcome and the largest uncommitted sessions.

## When to use

- The Code view of the Insights page, beside `FileChurn`.

## When NOT to use

- The commit rate itself - that is a tile in `InsightKpis`.
- Usage per branch - use `BranchBreakdown`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `YieldPanelView` | required | The card's view model, built by `buildYield()` in `@/lib/views/insights`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`YieldPanelView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. |
| `state` | `SectionState \| null` | Loading, error or empty; null when there are sessions to show. |
| `ai` | `SectionAi \| null` | The AI explanation affordance. |
| `stages` | `InsightRankedRow[]` | Sessions, In a git repo, Committed, Opened a PR. Each bar is drawn against the first stage; `title` says what the stage counts. |
| `stagesNote` | `string \| null` | What the PR stage leaves out or adds up to: the total number of PRs, and sessions that opened one without committing. |
| `tokens` | `{ key, label, value, tone, help }[]` | Effective tokens of committed, uncommitted and no-repo sessions. |
| `uncommitted` | `{ key, project, date, tokens }[]` | The five largest repo sessions that did not commit. |
| `footnote` | `string` | What counts as "in a repo". |

## States

- `loading` - meter skeletons. `error` - the request failed with nothing earlier to show. `empty` - no session in the window.
- Ready - the funnel, the token facts under a hairline, the uncommitted sessions when there are any, then the footnote.

## Usage

```tsx
import { YieldPanel } from '@/components/design-system/organisms/YieldPanel/YieldPanel';
```

```tsx
<SplitLayout>
  <YieldPanel view={view.yield} />
  <FileChurn view={view.churn} />
</SplitLayout>
```

## a11y

- The card is a region named by its title. The funnel is a list named "Sessions by stage"; every bar is a `role="progressbar"` with its count as text.
- The committed stages are drawn in the success colour and are also named in words.
- The no-repo row has a help button that says those sessions are left out of the commit rate.

## Notes

- Sessions outside a git repo could never commit, so they sit apart instead of counting as misses.
- Token figures are effective tokens.
