# SessionStatsGrid

**Level:** Organism
**Purpose:** The four session totals as stat tiles: how many sessions, the longest active one, the median turn time and the lines changed, each with a Claude and Codex split under Both.

## When to use

- The Sessions page, once, inside a `StatGridLayout`, above both of its views.

## When NOT to use

- Workflow totals - use `WorkflowStatsGrid`.
- One number in another page - use `StatTile`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `SessionStatsView` | required | The tiles and their state, from `buildSessionStats()` in `@/lib/views/sessions`. |

`SessionStatsView` fields:

| Field | Type | Description |
|---|---|---|
| `status` | `'loading' \| 'error' \| 'ready'` | Which state to draw. |
| `tiles` | `SessionStatView[]` | `key`, `label`, `value`, `sub`, `split`, `help`. `split` is the "Claude … · Codex …" line, or `null`. |
| `errorTitle`, `errorDescription` | `string` | The error state's copy. |

## States

- `loading` - four cards with the stat skeleton.
- `error` - one card across the whole row saying what failed.
- `ready` - the four tiles.

## Usage

```tsx
import { SessionStatsGrid } from '@/components/design-system/organisms/SessionStatsGrid/SessionStatsGrid';
```

```tsx
<StatGridLayout>
  <SessionStatsGrid view={page.stats} />
</StatGridLayout>
```

## a11y

- Each tile reads its label, its value and its context lines in that order; the help button is named "About" plus the label.
- The context line is `dir="auto"`, because the longest session is named by its title.

## Notes

- It renders a fragment of tiles, so the surrounding `StatGridLayout` lays them out; it adds no grid of its own.
- A tile's context is one line, or two under Both; each truncates on its own with the full text in `title`.
