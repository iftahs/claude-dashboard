# WorkflowStatsGrid

**Level:** Organism
**Purpose:** The nine all-time workflow totals as stat tiles: runs, success rate, tokens, agents, average duration, estimated cost, tool calls, top model and busiest day.

## When to use

- The top of the Workflows page, as the children of a `StatGridLayout`.

## When NOT to use

- A single number - use `StatTile`.
- Totals for one run - they are in the run's own row (`WorkflowRunRow`).
- Outside a grid: it renders the tiles themselves, with no wrapper, so the parent must lay them out.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `WorkflowStatsView` | required | The view model, built by `buildWorkflowStats()` in `@/lib/views/workflows`. |

`WorkflowStatsView` fields:

| Field | Type | Description |
|---|---|---|
| `status` | `'loading' \| 'error' \| 'hidden' \| 'ready'` | Which state renders. |
| `tiles` | `WorkflowStatView[]` | The nine tiles: `label`, `value`, `sub`, `tone` and `help`. |
| `errorTitle`, `errorDescription` | `string` | The error text. |

## States

- `loading` - nine tile-shaped cards, each with a stat skeleton.
- `error` - one card across the whole grid row that says the totals could not be loaded.
- `hidden` - nothing. Used when there are no runs on disk; the page should then leave the grid out, so no empty row is left behind.
- `ready` - the nine tiles. A value that does not exist yet is a dash.

## Usage

```tsx
import { WorkflowStatsGrid } from '@/components/design-system/organisms/WorkflowStatsGrid/WorkflowStatsGrid';
```

On the Workflows page:

```tsx
<StatGridLayout columns={5}>
  <WorkflowStatsGrid view={stats} />
</StatGridLayout>
```

Leaving the grid out when there is nothing to show:

```tsx
{stats.status === 'hidden' ? null : (
  <StatGridLayout columns={5}>
    <WorkflowStatsGrid view={stats} />
  </StatGridLayout>
)}
```

## a11y

- Each tile reads its label, value and context line in that order (see `StatTile`).
- The success rate takes the success tone and says "N completed, N failed" underneath, so the tone is never the only signal.
- The loading tiles are `role="status"` regions that read "Loading"; the error card is a `role="alert"`.

## Notes

- It returns a fragment: the tiles become direct cells of the surrounding grid. An organism cannot import a template, so the page supplies the `StatGridLayout`.
- With five columns the nine tiles fill two rows from `lg`, three rows from `md` and five rows below.
- "Est. cost" is a blended estimate and says so in its context line and its help.
- Presentational: no hooks, no fetching.
