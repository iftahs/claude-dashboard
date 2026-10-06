# InsightKpis

**Level:** Organism
**Purpose:** The four headline rates of the Insights page as stat tiles: failure rate, rejection rate, commit rate and delegation or auto-review rate.

## When to use

- The top of the Insights page, above every view, inside a `StatGridLayout`.

## When NOT to use

- The figures behind a rate - each has its own card (`ErrorBreakdown`, `RejectionsPanel`, `YieldPanel`, `SubagentStatsPanel`).
- Other rows of tiles - compose `StatTile` in a `StatGridLayout`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `InsightKpisView` | required | The tiles and their status, built by `buildInsightKpis()` in `@/lib/views/insights`. |

`InsightKpisView` fields:

| Field | Type | Description |
|---|---|---|
| `status` | `'loading' \| 'error' \| 'ready'` | Which of the three states to draw. |
| `tiles` | `{ key, label, value, sub, tone, help }[]` | The four tiles, in order. Empty unless `ready`. |
| `errorTitle` | `string` | What failed. |
| `errorDescription` | `string` | What happens next. |

## States

- `loading` - four tile-shaped skeletons.
- `error` - one card across the row with what failed.
- `ready` - the four tiles. A rate that does not apply reads "n/a"; under Both each tile's sub line splits the rate by platform.

## Usage

```tsx
import { InsightKpis } from '@/components/design-system/organisms/InsightKpis/InsightKpis';
```

```tsx
<StatGridLayout>
  <InsightKpis view={view.kpis} />
</StatGridLayout>
```

## a11y

- Each tile reads its label, value and sub line in that order; the help button is named "About" plus the label.
- The tone colours the value only: failure rate in danger, rejection rate in warning, commit rate in success. The label names the rate, so colour never carries it alone.

## Notes

- It renders the tiles as siblings with no wrapper, so the parent grid lays them out.
- Failures never include rejections: a declined or denied call never ran.
