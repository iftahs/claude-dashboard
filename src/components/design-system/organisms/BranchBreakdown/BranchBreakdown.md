# BranchBreakdown

**Level:** Organism
**Purpose:** Card that lists the git branches the work went into, each as repo and branch with its effective tokens, estimated cost and session count over a bar.

## When to use

- The Code view of the Insights page, beside `LanguageBreakdown`.

## When NOT to use

- Usage by project folder - that belongs to the Trends page.
- Whether the work on a branch was committed - use `YieldPanel`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `BranchBreakdownView` | required | The card's view model, built by `buildBranches()` in `@/lib/views/insights`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`BranchBreakdownView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. |
| `state` | `SectionState \| null` | Loading, error or empty; null when there are branches to show. |
| `ai` | `SectionAi \| null` | The AI explanation affordance. |
| `rows` | `{ key, label, value, note, percent }[]` | One row per branch: "repo / branch" with its effective tokens, a bar that is the share of the busiest branch, and a note with the estimated cost and the session count. |

## States

- `loading` - meter skeletons. `error` - the request failed with nothing earlier to show.
- `empty` - no session recorded a branch. Under Codex the text says chat threads run outside a git repo.
- Ready - one meter per branch.

## Usage

```tsx
import { BranchBreakdown } from '@/components/design-system/organisms/BranchBreakdown/BranchBreakdown';
```

```tsx
<SplitLayout>
  <LanguageBreakdown view={view.languages} />
  <BranchBreakdown view={view.branches} />
</SplitLayout>
```

## a11y

- The card is a region named by its title. The list is named "Usage by git branch"; every bar is a `role="progressbar"` named by its branch.
- A truncated branch name keeps its full text in `title`.

## Notes

- Tokens are effective tokens. The cost is an estimate and is written with a tilde.
