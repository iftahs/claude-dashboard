# SpendKpiTiles

**Level:** Organism
**Purpose:** The four headline spend numbers of the selected range as stat tiles: estimated cost, effective tokens, average cost per day and the month-end projection, each with a line of context and, under both platforms, the Claude and Codex split.

## When to use

- The first row of the Trends page's Spend view, inside a `StatGridLayout`.

## When NOT to use

- Lifetime numbers - use `ActivitySummary`.
- Spend against a cap - use `SpendCapsCard`.
- A single number - use `StatTile`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `SpendKpisView` | required | Built by `buildSpendKpis()` in `@/lib/views/trends`: the status, the four tiles and the error message. |

## States

- `ready`: one `StatTile` per entry. `lines` stack under the value, each truncating on its own with its full text in `title`: the tile's own context first, then "Claude ~$12.40 · Codex ~$3.10" when both platforms are on screen.
- `loading`: four stat-shaped skeleton tiles.
- `error`: one card across the whole row that says what failed.

## Usage

```tsx
import { SpendKpiTiles } from '@/components/design-system/organisms/SpendKpiTiles/SpendKpiTiles';
```

```tsx
<StatGridLayout>
  <SpendKpiTiles view={view.kpis} />
</StatGridLayout>
```

## a11y

- Each tile reads its label, value and context lines in that order; the help button is named "About <label>".
- The projection tile takes the accent tone; its label says what it is, so the colour carries no meaning alone.

## Notes

- It renders a fragment of tiles, so the grid template around it lays them out.
- Memoised on `view`: build it in a `useMemo` in the page hook.
- Every cost is an estimate at list API prices, written with a tilde.
