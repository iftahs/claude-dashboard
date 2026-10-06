# ActivitySummary

**Level:** Organism
**Purpose:** The four all-history activity numbers as stat tiles: lifetime effective tokens, the peak day, the current streak and the count of active days, each with its context and, under both platforms, the Claude and Codex split.

## When to use

- The Trends page's Activity view, inside a `StatGridLayout` under an "Activity summary" group label.

## When NOT to use

- Numbers of the selected range - use `SpendKpiTiles`.
- A day-by-day view - use `ActivityHeatmap`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `ActivitySummaryView` | required | Built by `buildActivitySummary()` in `@/lib/views/trends`: the status, the four tiles and the error message. |

## States

- `ready`: one `StatTile` per entry. `lines` stack under the value, each truncating on its own with its full text in `title`: the tile's own context, then the Claude and Codex split under both platforms (two parts that wrap onto two lines in a narrow tile), then OpenAI's server-side lifetime count on the first tile when it is available ("OpenAI 483M", "vs 410M local", also wrapping).
- `loading`: four stat-shaped skeleton tiles.
- `error`: one card across the whole row that says what failed.
- `hidden`: renders nothing. The page leaves the group out when there is no history at all.

## Usage

```tsx
import { ActivitySummary } from '@/components/design-system/organisms/ActivitySummary/ActivitySummary';
```

```tsx
{view.summary.status === 'hidden' ? null : (
  <SectionStackLayout title={<GroupLabel note="All history">Activity summary</GroupLabel>}>
    <StatGridLayout>
      <ActivitySummary view={view.summary} />
    </StatGridLayout>
  </SectionStackLayout>
)}
```

## a11y

- Each tile reads its label, value and context lines in that order; the help button is named "About <label>".

## Notes

- It renders a fragment of tiles, so the grid template around it lays them out.
- Memoised on `view`: build it in a `useMemo` in the page hook.
- "Lifetime" reaches back only as far as the logs on disk; the first tile's help says why for the platform on screen.
